import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { teamCode } = await request.json();

    if (!teamCode) {
      return NextResponse.json(
        { error: 'ログインコードを入力してください' },
        { status: 400 }
      );
    }

    const teamsRef = adminDb.collection('teams');
    const teamQuery = await teamsRef
      .where('teamCode', '==', teamCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (teamQuery.empty) {
      return NextResponse.json(
        { error: '入力されたログインコードが見つかりません' },
        { status: 404 }
      );
    }

    const teamDoc = teamQuery.docs[0];
    const teamData = teamDoc.data();

    // 学外配布日の判定（どちらも一致で許可）
    const fmtJst = (d: Date) => {
      const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(d);
      const y = parts.find(p => p.type === 'year')?.value || '';
      const m = parts.find(p => p.type === 'month')?.value || '';
      const da = parts.find(p => p.type === 'day')?.value || '';
      return `${y}-${m}-${da}`;
    };

    const todayKey = fmtJst(new Date());
    // team.validDate
    let validKey: string | null = null;
    try {
      if (teamData.validDate) {
        const vd = teamData.validDate._seconds ? new Date(teamData.validDate._seconds * 1000)
          : (typeof teamData.validDate === 'string' ? new Date(teamData.validDate) : new Date(teamData.validDate));
        if (!isNaN(vd.getTime())) validKey = fmtJst(vd);
      }
    } catch {}

    // event.distributionDate / distributionStartDate - distributionEndDate（team.eventId から解決）
    let distKey: string | null = null;
    let distStartKey: string | null = null;
    let distEndKey: string | null = null;
    try {
      if (teamData.eventId) {
        const evDoc = await adminDb.collection('distributionEvents').doc(teamData.eventId).get();
        if (evDoc.exists) {
          const ev = evDoc.data() as Record<string, unknown>;
          const parseDate = (v: Record<string, unknown> | string | Date) => (v as Record<string, unknown>)?._seconds ? new Date((v as Record<string, unknown>)._seconds as number * 1000)
            : (typeof v === 'string' ? new Date(v) : new Date(v as unknown as Date));
          if (ev?.distributionStartDate || ev?.distributionEndDate) {
            const ds = ev.distributionStartDate ? parseDate(ev.distributionStartDate as Record<string, unknown> | string | Date) : null;
            const de = ev.distributionEndDate ? parseDate(ev.distributionEndDate as Record<string, unknown> | string | Date) : null;
            if (ds && !isNaN(ds.getTime())) distStartKey = fmtJst(ds);
            if (de && !isNaN(de.getTime())) distEndKey = fmtJst(de);
          }
          if (ev?.distributionDate) {
            const dd = parseDate(ev.distributionDate as Record<string, unknown> | string | Date);
            if (!isNaN(dd.getTime())) distKey = fmtJst(dd);
          }
        }
      }
    } catch {}

    // どちらも存在し、かつ当日一致（イベントは単日一致 or 期間内一致）
    if (!validKey || (!distKey && !(distStartKey && distEndKey))) {
      return NextResponse.json({ error: '配布日が未設定です（team.validDate と event.distribution(単日 or 期間) の両方を設定してください）' }, { status: 403 });
    }
    const inRange = distStartKey && distEndKey ? (distStartKey <= todayKey && todayKey <= distEndKey) : (distKey === todayKey);
    if (!(validKey === todayKey && inRange)) {
      const dispValid = validKey.replace(/-/g, '/');
      const dispDist = distStartKey && distEndKey
        ? `${distStartKey.replace(/-/g,'/')}〜${distEndKey.replace(/-/g,'/')}`
        : (distKey ? distKey.replace(/-/g,'/') : '-');
      return NextResponse.json({ error: `本日は配布日ではありません。班: ${dispValid} / イベント: ${dispDist}` }, { status: 403 });
    }

    // 一時メールアドレス + パスワード方式
    const tempEmail = `${teamData.teamCode}@temp.kohdai-poster.local`;
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4);

    // 既存ユーザー確認 or 作成
    let uid: string | null = null;
    try {
      const existing = await adminAuth.getUserByEmail(tempEmail);
      uid = existing.uid;
      // 既存の一時ユーザーのパスワードをローテーション
      await adminAuth.updateUser(uid, { password: tempPassword, emailVerified: true, displayName: teamData.teamName || teamData.teamCode, disabled: false });
    } catch {
      const created = await adminAuth.createUser({ email: tempEmail, password: tempPassword, emailVerified: true, displayName: teamData.teamName || teamData.teamCode, disabled: false });
      uid = created.uid;
    }

    // カスタムクレームを設定（班情報）
    if (uid) {
      await adminAuth.setCustomUserClaims(uid, {
        teamCode: teamData.teamCode,
        teamId: teamDoc.id,
        role: 'team',
        tempUser: true
      });
    }

    // 一時アカウント情報を記録
    const tempAccountRef = adminDb.collection('tempAccounts').doc();
    await tempAccountRef.set({
      accountId: tempAccountRef.id,
      teamCode: teamData.teamCode,
      tempEmail,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true
    });

    return NextResponse.json({
      success: true,
      tempEmail,
      tempPassword,
      teamData: {
        teamId: teamDoc.id,
        teamCode: teamData.teamCode,
        teamName: teamData.teamName,
        assignedArea: teamData.assignedArea,
        adjacentAreas: teamData.adjacentAreas
      }
    });

  } catch (error) {
    console.error('Team login error:', error);
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    );
  }
}
