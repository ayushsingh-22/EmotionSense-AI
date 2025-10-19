import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json();

    console.log('Testing signup for:', { email, fullName });

    // Test with the regular client first
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: fullName
      },
      email_confirm: true // Auto-confirm email for testing
    });

    if (signUpError) {
      console.error('Admin signup error:', signUpError);
      return NextResponse.json({
        success: false,
        error: signUpError.message,
        details: signUpError
      });
    }

    console.log('Admin signup successful:', signUpData);

    return NextResponse.json({
      success: true,
      data: signUpData,
      message: 'User created successfully via admin API'
    });

  } catch (error) {
    console.error('Test signup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error
    });
  }
}