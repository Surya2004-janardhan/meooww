import axios from 'axios';
import prisma from '../lib/prisma';
import { publishToQueue } from '../queue/amqp';

// Mock memory manager for now (to be integrated properly later)
const memoryManager = {
  getRelevantContext: async (userId: string, query: string) => "",
  addInteraction: async (userId: string, messages: any[]) => {}
};

async function executeToolInternal(userId: string, toolId: string, input: any) {
  const apiSecret = process.env.INTERNAL_API_SECRET;
  const baseUrl = `http://localhost:${process.env.PORT || 4000}`;
  
  try {
    const res = await axios.post(`${baseUrl}/api/tools/${toolId}/execute`, 
      { input },
      { 
        headers: { 
          'x-internal-secret': apiSecret,
          'x-user-id': userId
        } 
      }
    );
    return res.data;
  } catch (error: any) {
    console.error(`[Worker] Tool execution error:`, error.response?.data || error.message);
    return { error: error.message };
  }
}

export async function processAgentTask(task: any) {
  const { userId, agentId, messages, provider, model, temperature = 0.7, maxTokens = 2000 } = task;

  console.log(`[Worker] Processing agent task for user ${userId}, agent ${agentId}`);

  // --- Agent Loop ---
  let loopCount = 0;
  const maxLoops = 5;
  let finalResponse = null;

  // Add tool instructions
  const systemIndex = messages.findIndex((m: any) => m.role === 'system');
  const toolInstructions = `\n\nYou have access to various tools. If you need to perform an action, use the following JSON format:
{"thought": "Your reasoning", "tool": "tool-id", "input": {"arg": "value"}}
When you have the final answer, provide it directly without the JSON block.`;

  if (systemIndex > -1) {
    messages[systemIndex].content += toolInstructions;
  } else {
    messages.unshift({ role: 'system', content: `You are a helpful assistant.${toolInstructions}` });
  }

  while (loopCount < maxLoops) {
    loopCount++;
    let responseText = "";

    try {
      const baseUrl = process.env.CUSTOM_LLM_BASE_URL || "https://api.openai.com/v1";
      const apiKey = process.env.OPENAI_API_KEY;
      
      const response = await axios.post(`${baseUrl}/chat/completions`, {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });

      responseText = response.data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      console.error("[Worker] LLM Request failed:", error.response?.data || error.message);
      break;
    }

    // Check for tool calling JSON
    const jsonMatch = responseText.match(/\{[\s\S]*"tool"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const toolCall = JSON.parse(jsonMatch[0]);
        console.log(`[Worker] Loop ${loopCount}: Executing tool ${toolCall.tool}`);
        
        const toolOutput = await executeToolInternal(userId, toolCall.tool, toolCall.input);
        
        messages.push({ role: "assistant", content: responseText });
        messages.push({ role: "user", content: `Observation from ${toolCall.tool}: ${JSON.stringify(toolOutput)}` });
        continue;
      } catch (e) {
        console.error("[Worker] JSON Parse error:", e);
      }
    }

    finalResponse = responseText;
    break;
  }

  // Publish event for webhook or UI
  await publishToQueue('webhook_events', {
    type: 'agent.completed',
    userId,
    agentId,
    output: finalResponse,
    timestamp: new Date().toISOString()
  });

  return finalResponse;
}
