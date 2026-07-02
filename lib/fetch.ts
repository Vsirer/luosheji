
/**
 * Safely parses JSON from a fetch response, checking the content-type first.
 * If the response is not JSON, it returns null or throws an error with the response text.
 */
export async function safeJson<T = any>(response: Response): Promise<T | null> {
  const url = response.url || 'unknown url';
  const status = response.status;
  
  try {
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    // Read text first to handle both JSON and non-JSON error messages
    let text = "";
    try {
      text = await response.text();
    } catch (readErr: any) {
      // If reading the body fails, it's likely a network interruption
      if (readErr.name === 'AbortError') throw readErr;
      
      const isNetworkError = readErr.message?.includes('fetch') || readErr.message?.includes('NetworkError');
      if (!isNetworkError) {
        console.error(`[safeJson] Failed to read response body from ${url} (${status}):`, readErr);
      }
      throw readErr;
    }

    if (!text || text.trim() === "") {
      if (!response.ok) {
        throw new Error(`Request to ${url} returned empty body (Status: ${status})`);
      }
      return null;
    }

    if (isJson) {
      try {
        return JSON.parse(text) as T;
      } catch (parseErr) {
        if (!response.ok) {
          // If not OK and not valid JSON, throw the raw text as error
          throw new Error(`Request to ${url} failed (${status}) and returned non-JSON: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
        }
        console.error(`[safeJson] JSON parse error from ${url}:`, parseErr, "\nRaw text:", text.slice(0, 500));
        throw parseErr;
      }
    }

    // Not JSON but OK status
    if (response.ok) {
      console.warn(`[safeJson] Expected JSON but received non-JSON response from ${url} (Status: ${status}). Preview: ${text.slice(0, 200)}`);
      return null;
    }

    // Not JSON and not OK status
    throw new Error(`Request to ${url} failed (${status}): ${text.slice(0, 500)}`);

  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    
    // Check if it's a network error we already handled or should ignore logging for
    const isNetworkError = e.message?.includes('fetch') || e.message?.includes('NetworkError');
    if (!isNetworkError) {
      // Only log unexpected errors
      console.error(`[safeJson] Error processing response from ${url}:`, e);
    }
    throw e;
  }
}
