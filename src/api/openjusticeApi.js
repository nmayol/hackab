/**
 * OpenJustice API Client
 * Handles all API interactions with the OpenJustice service
 *
 * The API key is configured to automatically use:
 * - Flow: "tester"
 * - Chat: "test convo"
 * These are specified when creating the API key, so we don't need to pass them explicitly.
 */

/**
 * Get API configuration from environment variables
 */
export function getApiConfig() {
  const apiKey = import.meta.env.VITE_OPENJUSTICE_API_KEY;
  const apiUrl =
    import.meta.env.VITE_OPENJUSTICE_API_URL ||
    "https://api.staging.openjustice.ai";

  if (!apiKey) {
    throw new Error("API key not found. Please check your .env file.");
  }

  return { apiKey, apiUrl };
}

/**
 * Upload a file to OpenJustice
 * @param {File} file - The file to upload
 * @param {string} apiKey - API key for authentication
 * @param {string} apiUrl - Base API URL
 * @returns {Promise<{resourceId: string, fileName: string}>}
 */
export async function uploadFile(file, apiKey, apiUrl) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiUrl}/conversation/resources/upload-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  if (!result.ok || !result.resourceId) {
    throw new Error("Failed to upload file: Invalid response");
  }

  return {
    resourceId: result.resourceId,
    fileName: result.fileName,
  };
}

/**
 * Process Server-Sent Events from the API stream
 * @param {string} eventText - The raw SSE event text
 * @param {Object} fullResponse - The response object being built
 * @param {Function} onUpdate - Callback to update the response
 */
function processStreamEvent(eventText, fullResponse, onUpdate) {
  const lines = eventText.split("\n").filter((line) => line.trim());
  let eventType = "message";
  let data = "";

  const dataLines = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("event:")) {
      eventType = trimmedLine.substring(6).trim();
    } else if (trimmedLine.startsWith("data:")) {
      const dataContent = trimmedLine.substring(5);
      dataLines.push(dataContent);
    }
  }

  data = dataLines.join("\n");
  if (!data) return;

  try {
    const parsed = JSON.parse(data);

    switch (eventType) {
      case "message":
        if (parsed.text) {
          fullResponse.messages.push(parsed.text);
          onUpdate(JSON.stringify(fullResponse, null, 2));
        }
        break;

      case "node-result":
        fullResponse.nodeResults.push(parsed);
        onUpdate(JSON.stringify(fullResponse, null, 2));
        break;

      case "awaiting-user-input":
        fullResponse.awaitingInput = parsed;
        onUpdate(JSON.stringify(fullResponse, null, 2));
        break;

      case "flow-complete":
        fullResponse.complete = true;
        fullResponse.finalResult = parsed;
        onUpdate(JSON.stringify(fullResponse, null, 2));
        break;

      default:
        if (!fullResponse.otherEvents) {
          fullResponse.otherEvents = [];
        }
        fullResponse.otherEvents.push({ type: eventType, data: parsed });
        onUpdate(JSON.stringify(fullResponse, null, 2));
    }
  } catch (error) {
    // Silently ignore parse errors for malformed events
    console.debug("Could not parse SSE event:", error);
  }
}

/**
 * Stream the flow execution response
 * The API key automatically routes to the correct flow and chat
 * @param {string} conversationId - The conversation ID returned from sending the message
 * @param {string} apiKey - API key for authentication
 * @param {string} apiUrl - Base API URL
 * @param {Function} onUpdate - Callback to update the response as it streams
 * @returns {Promise<Object>} The complete response object
 */
async function streamFlowResponse(conversationId, apiKey, apiUrl, onUpdate) {
  // Wait a moment to ensure the message is processed
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const fullResponse = {
    success: true,
    conversationId: conversationId,
    messages: [],
    nodeResults: [],
    complete: false,
  };

  // The API key handles routing to the correct flow ("tester") and chat ("test convo")
  // We only need to pass the conversationId - the API will use the flow configured in the API key
  const streamUrl = `${apiUrl}/nap/stream?conversationId=${encodeURIComponent(
    conversationId
  )}`;

  console.log(`Streaming flow response for conversation ${conversationId}`);
  console.log("Stream URL:", streamUrl);

  const streamResponse = await fetch(streamUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
  });

  if (!streamResponse.ok) {
    const errorText = await streamResponse.text();
    console.error("Stream error response:", errorText);
    throw new Error(
      `Failed to stream flow response: ${streamResponse.status} ${errorText}`
    );
  }

  if (!streamResponse.body) {
    throw new Error("Response body is null");
  }

  // Process the stream
  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasReceivedData = false;

  console.log("Starting to read stream...");

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log("Stream finished. Has received data:", hasReceivedData);
      if (buffer.trim()) {
        processStreamEvent(buffer, fullResponse, onUpdate);
      }
      break;
    }

    hasReceivedData = true;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventText of events) {
      if (eventText.trim()) {
        console.debug("Processing event:", eventText.substring(0, 100));
        processStreamEvent(eventText, fullResponse, onUpdate);
      }
    }
  }

  if (!hasReceivedData) {
    console.warn("No data received from stream.");
    fullResponse.warning =
      "No response received from flow. The flow may still be processing.";
  }

  return fullResponse;
}

/**
 * Send a message with image and description to OpenJustice
 * The API key automatically routes to the configured flow ("tester") and chat ("test convo")
 * @param {string} description - User's description/prompt
 * @param {Object} uploadedFile - Uploaded file metadata {resourceId, fileName}
 * @param {string} apiKey - API key for authentication
 * @param {string} apiUrl - Base API URL
 * @returns {Promise<{conversationId: string, response?: any}>}
 */
export async function sendMessageWithImage(
  description,
  uploadedFile,
  apiKey,
  apiUrl
) {
  const messagePayload = {
    prompt: description,
    messages: [
      {
        role: "user",
        content: description,
        metadata: {
          resources: [
            {
              id: uploadedFile.resourceId,
              name: uploadedFile.fileName,
            },
          ],
        },
      },
    ],
  };

  // Don't specify conversationId - let the API key route to the configured chat ("test convo")
  // Don't specify dialogFlowId - let the API key route to the configured flow ("tester")

  const response = await fetch(`${apiUrl}/conversation/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messagePayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log("Message sent, API response:", result);

  const conversationId = result.conversationId;

  if (!conversationId) {
    throw new Error("API did not return a conversation ID");
  }

  return {
    conversationId: conversationId,
    response: result,
  };
}

/**
 * Process an image and description through the OpenJustice API
 * This is the main function that orchestrates the entire flow.
 * The API key automatically handles routing to the "tester" flow and "test convo" chat.
 *
 * @param {File} image - The image file to process
 * @param {string} description - User's description/prompt
 * @param {Function} onUpdate - Callback to update the response as it streams
 * @returns {Promise<Object>} The complete response
 */
export async function processImageWithDescription(
  image,
  description,
  onUpdate
) {
  const { apiKey, apiUrl } = getApiConfig();

  // Step 1: Upload the image file
  console.log("Uploading image file...");
  const uploadedFile = await uploadFile(image, apiKey, apiUrl);
  console.log("File uploaded:", uploadedFile);

  // Step 2: Send message with image and description
  // The API key will automatically route to:
  // - Flow: "tester"
  // - Chat: "test convo"
  console.log("Sending message with image and description...");
  const messageResult = await sendMessageWithImage(
    description,
    uploadedFile,
    apiKey,
    apiUrl
  );

  const conversationId = messageResult.conversationId;
  console.log("Conversation ID:", conversationId);

  // Step 3: Stream the flow response
  // The flow should automatically process the image and description
  console.log("Streaming flow response...");
  const fullResponse = await streamFlowResponse(
    conversationId,
    apiKey,
    apiUrl,
    onUpdate
  );

  // Add metadata to the response
  fullResponse.uploadedFile = {
    id: uploadedFile.resourceId,
    fileName: uploadedFile.fileName,
  };
  fullResponse.description = description;

  return fullResponse;
}
