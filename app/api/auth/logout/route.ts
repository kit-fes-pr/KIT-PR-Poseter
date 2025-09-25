import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        if (decodedToken.role === 'team') {
          const tempAccountsRef = adminDb.collection('tempAccounts');
          const tempAccountQuery = await tempAccountsRef
            .where('teamCode', '==', decodedToken.teamCode)
            .where('isActive', '==', true)
            .get();
          
          const batch = adminDb.batch();
          tempAccountQuery.docs.forEach(doc => {
            batch.update(doc.ref, { isActive: false });
          });
          
          await batch.commit();
        }
        
        await adminAuth.deleteUser(decodedToken.uid);
      } catch (error) {
        console.error('Token verification failed:', error);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'ログアウトに失敗しました' },
      { status: 500 }
    );
  }
}
