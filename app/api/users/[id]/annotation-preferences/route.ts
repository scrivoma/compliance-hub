import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/users/[id]/annotation-preferences - Load user preferences
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Only allow users to access their own preferences
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Can only access your own preferences' },
        { status: 403 }
      )
    }

    // Get user preferences
    const preferences = await prisma.userAnnotationPreferences.findUnique({
      where: { userId: userId }
    })

    // If no preferences exist, return defaults
    if (!preferences) {
      return NextResponse.json({
        defaultColor: '#FFFF00',
        showCoachMarks: true,
        preferences: {}
      })
    }

    return NextResponse.json({
      defaultColor: preferences.defaultColor,
      showCoachMarks: preferences.showCoachMarks,
      preferences: preferences.preferences || {}
    })

  } catch (error) {
    console.error('Error loading user annotation preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id]/annotation-preferences - Save user preferences
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Only allow users to update their own preferences
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Can only update your own preferences' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { defaultColor, showCoachMarks, preferences } = body

    // Prepare update data (only include defined fields)
    const updateData: any = {}
    if (defaultColor !== undefined) {
      updateData.defaultColor = defaultColor
    }
    if (showCoachMarks !== undefined) {
      updateData.showCoachMarks = showCoachMarks
    }
    if (preferences !== undefined) {
      updateData.preferences = preferences
    }

    // Upsert user preferences
    const updatedPreferences = await prisma.userAnnotationPreferences.upsert({
      where: { userId: userId },
      create: {
        userId: userId,
        defaultColor: defaultColor || '#FFFF00',
        showCoachMarks: showCoachMarks !== undefined ? showCoachMarks : true,
        preferences: preferences || {}
      },
      update: updateData
    })

    return NextResponse.json({
      defaultColor: updatedPreferences.defaultColor,
      showCoachMarks: updatedPreferences.showCoachMarks,
      preferences: updatedPreferences.preferences || {}
    })

  } catch (error) {
    console.error('Error saving user annotation preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/annotation-preferences - Reset user preferences to defaults
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Only allow users to delete their own preferences
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Can only delete your own preferences' },
        { status: 403 }
      )
    }

    // Delete user preferences (will fall back to defaults)
    await prisma.userAnnotationPreferences.deleteMany({
      where: { userId: userId }
    })

    return NextResponse.json({
      message: 'Preferences reset to defaults',
      defaultColor: '#FFFF00',
      showCoachMarks: true,
      preferences: {}
    })

  } catch (error) {
    console.error('Error deleting user annotation preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}