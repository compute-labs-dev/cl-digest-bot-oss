// app/api/agent/execute/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ConfigurationAgent } from '../../../../../lib/agent/configuration-agent';
import { pendingActions } from '../shared-storage';
import logger from '../../../../../lib/logger';

const configAgent = new ConfigurationAgent();

export async function POST(request: NextRequest) {
  try {
    const { messageId, action, actionId } = await request.json();

    if (action !== 'confirm') {
      return NextResponse.json({
        success: false,
        message: '👍 Action cancelled successfully.'
      });
    }

    logger.info('Executing confirmed action', { messageId, actionId });

    // Retrieve the stored intent
    const storedAction = pendingActions.get(actionId);
    if (!storedAction) {
      logger.error('Pending action not found', { actionId });
      return NextResponse.json({
        success: false,
        message: '❌ Action not found or expired. Please try again.'
      }, { status: 404 });
    }

    // Execute the stored intent
    const result = await configAgent.executeIntent(storedAction.intent);
    
    // Clean up the stored action
    pendingActions.delete(actionId);

    logger.info('Action executed', { 
      actionId, 
      success: result.success,
      changeId: result.changeId 
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      changes: result.changes || [],
      rollbackAvailable: !!result.changeId
    });

  } catch (error: any) {
    logger.error('Execute API error', { error: error.message });
    
    return NextResponse.json({
      success: false,
      message: `❌ Failed to execute action: ${error.message}`
    }, { status: 500 });
  }
}