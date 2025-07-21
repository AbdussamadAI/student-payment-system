import axios from 'axios';

// Remita API Configuration based on official SDK pattern
const REMITA_CONFIG = {
  // Demo environment
  demoUrl: 'https://demo.remita.net',
  // Production environment
  liveUrl: 'https://login.remita.net',
  // API endpoints
  generateRrrEndpoint: '/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit',
  // Demo credentials (Replace with your actual credentials in production)
  merchantId: '2547916',
  apiKey: '1946',
  serviceTypeId: '4430731'
};

interface GenerateRRRParams {
  amount: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  description: string;
}

interface RemitaResponse {
  RRR?: string;
  status?: string;
  statuscode?: string;
  message?: string;
  transactionId?: string;
  [key: string]: any;
}

/**
 * Generate a Remita Retrieval Reference (RRR) for payment
 * 
 * @param params Payment parameters
 * @returns Promise with the RRR response
 */
/**
 * Generate a real RRR from Remita using the official SDK pattern
 */
export const generateRRR = async (params: GenerateRRRParams): Promise<RemitaResponse> => {
  try {
    console.log('Generating RRR with params:', params);
    
    // Generate a unique order ID for this payment
    const orderId = `SCH_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    // Convert amount to string as expected by Remita API
    const amountString = params.amount.toString();
    
    // Generate hash for API authentication as specified in Remita documentation
    // Hash is generated from: merchantId + serviceTypeId + orderId + amount + apiKey
    const apiHashString = REMITA_CONFIG.merchantId + REMITA_CONFIG.serviceTypeId + 
                         orderId + amountString + REMITA_CONFIG.apiKey;
    const apiHash = await generateSHA512(apiHashString);
    
    console.log('Payment details:', {
      merchantId: REMITA_CONFIG.merchantId,
      serviceTypeId: REMITA_CONFIG.serviceTypeId,
      orderId: orderId,
      amount: amountString,
      apiHash: apiHash
    });
    
    // Request body as specified in Remita documentation
    const requestBody = {
      serviceTypeId: REMITA_CONFIG.serviceTypeId,
      amount: amountString,
      orderId: orderId,
      payerName: params.payerName,
      payerEmail: params.payerEmail || 'student@example.com',
      payerPhone: params.payerPhone || '08012345678',
      description: params.description,
      // Add custom fields if needed
      customFields: [
        {
          name: "Student ID",
          value: orderId,
          type: "ALL"
        }
      ]
    };
    
    // Request headers with authentication as specified in Remita documentation
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `remitaConsumerKey=${REMITA_CONFIG.merchantId},remitaConsumerToken=${apiHash}`
    };
    
    console.log('Sending request to Remita API...');
    
    // Make the API request to generate RRR
    const response = await axios.post(
      `${REMITA_CONFIG.demoUrl}${REMITA_CONFIG.generateRrrEndpoint}`,
      requestBody,
      { headers }
    );
    
    console.log('Remita API response:', response.data);
    
    // Process the response
    // Remita might return JSONP-wrapped response
    const jsonResponse = extractResponseData(response.data);
    
    if (jsonResponse && jsonResponse.RRR) {
      // Successful RRR generation
      return {
        status: jsonResponse.statuscode || '00',
        RRR: jsonResponse.RRR,
        message: jsonResponse.statusMessage || 'RRR generated successfully',
        transactionId: orderId
      };
    } else {
      // Failed RRR generation
      console.error('Failed to generate RRR from Remita API', jsonResponse);
      return {
        status: 'error',
        message: jsonResponse?.statusMessage || 'Failed to generate RRR',
        transactionId: orderId
      };
    }
  } catch (error: any) {
    console.error('Error generating RRR:', error);
    
    // Return error
    return { 
      status: 'error', 
      message: `Failed to connect to Remita API: ${error.message}`,
      transactionId: `ERR_${Date.now()}`
    };
  }
};

/**
 * Verify a payment using the RRR
 * 
 * @param rrr Remita Retrieval Reference
 * @returns Promise with the verification response
 */
/**
 * Verify RRR payment status using the official SDK pattern
 */
export const verifyPayment = async (rrr: string): Promise<RemitaResponse> => {
  try {
    console.log('Verifying payment for RRR:', rrr);
    
    // Generate hash for API authentication
    // Hash is generated from: rrr + apiKey + merchantId
    const apiHash = await generateSHA512(rrr + REMITA_CONFIG.apiKey + REMITA_CONFIG.merchantId);
    
    // Build status check URL
    const statusCheckPath = `/remita/exapp/api/v1/send/api/echannelsvc/${REMITA_CONFIG.merchantId}/${rrr}/${apiHash}/status.reg`;
    
    // Request headers with authentication
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `remitaConsumerKey=${REMITA_CONFIG.merchantId},remitaConsumerToken=${apiHash}`
    };
    
    console.log('Checking RRR status:', rrr);
    
    // Make the API request to verify RRR status
    const response = await axios.get(
      `${REMITA_CONFIG.demoUrl}${statusCheckPath}`,
      { headers }
    );
    
    console.log('Status check response:', response.data);
    
    // Process the response
    const jsonResponse = extractResponseData(response.data);
    
    if (jsonResponse) {
      return {
        status: jsonResponse.status || jsonResponse.statuscode || 'unknown',
        message: jsonResponse.statusMessage || jsonResponse.message || 'Payment verification completed',
        transactionId: rrr,
        // Add additional response data if needed
        amount: jsonResponse.amount,
        paymentDate: jsonResponse.paymentDate
      };
    } else {
      return {
        status: 'error',
        message: 'Invalid response from verification server',
        transactionId: rrr
      };
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return { 
      status: 'failed', 
      message: `Failed to verify payment: ${error.message}`,
      transactionId: rrr
    };
  }
};

/**
 * Generate SHA-512 hash for Remita API authentication
 * This implementation uses browser's SubtleCrypto API
 */
async function generateSHA512(input: string): Promise<string> {
  try {
    // Use browser's SubtleCrypto API for SHA-512 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-512', data);
    
    // Convert buffer to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Error generating hash with SubtleCrypto:', error);
    // Fallback implementation if SubtleCrypto fails
    return fallbackHashImplementation(input);
  }
}

/**
 * Fallback hash implementation in case crypto library is not available
 * This is not as secure as the proper crypto implementation
 */
function fallbackHashImplementation(input: string): string {
  // Simple hash algorithm (not recommended for production)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Extract data from Remita API response
 * Handles both JSON and JSONP formatted responses
 */
function extractResponseData(response: any): any {
  // If response is already an object, return it
  if (typeof response === 'object' && response !== null) {
    return response;
  }
  
  // If response is a string, check if it's JSONP
  if (typeof response === 'string') {
    try {
      // Try to parse as JSON first
      return JSON.parse(response);
    } catch (e) {
      // If it's not valid JSON, check if it's JSONP
      try {
        // Extract JSON object from JSONP response (format: jsonp12345({...}))
        const jsonStart = response.indexOf('(');
        const jsonEnd = response.lastIndexOf(')');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = response.substring(jsonStart + 1, jsonEnd);
          return JSON.parse(jsonStr);
        }
      } catch (e2) {
        console.error('Error parsing Remita response:', e2);
      }
    }
  }
  
  // If all parsing attempts fail, return the original response
  return response;
}

/**
 * Initialize Remita Payment Engine in the browser
 * This function must be called on the client-side
 */
export const initRemitaPayment = (
  rrr: string, 
  onSuccess: (response: any) => void,
  onError: (response: any) => void,
  onClose: () => void
) => {
  // Check if RmPaymentEngine is available (it should be loaded from Remita's CDN)
  if (typeof window !== 'undefined' && (window as any).RmPaymentEngine) {
    const paymentEngine = (window as any).RmPaymentEngine.init({
      key: 'QzAwMDAyNzEyNTl8MTEwNjE4NjF8OWZjOWYwNmMyZDk3MDRhYWM3YThiOThlNTNjZTE3ZjYxOTY5NDdmZWE1YzU3NDc0ZjE2ZDZjNTg1YWYxNWY3NWM4ZjMzNzZhNjNhZWZlOWQwNmJhNTFkMjIxYTRiMjYzZDkzNGQ3NTUxNDIxYWNlOGY4ZWEyODY3ZjlhNGUwYTY=',
      processRrr: true,
      transactionId: Math.floor(Math.random() * 1101233),
      extendedData: {
        customFields: [{
          name: "rrr",
          value: rrr
        }]
      },
      onSuccess: onSuccess,
      onError: onError,
      onClose: onClose
    });
    
    // Display the payment widget
    paymentEngine.showPaymentWidget();
    return paymentEngine;
  } else {
    console.error('Remita Payment Engine not loaded');
    return null;
  }
};

/**
 * Get payment status text from status code
 */
export const getPaymentStatusText = (statusCode: string): string => {
  switch (statusCode) {
    case '00':
    case '01':
      return 'Payment Successful';
    case '021':
      return 'Transaction Pending';
    case '023':
      return 'Invalid RRR';
    default:
      return 'Unknown Status';
  }
};
