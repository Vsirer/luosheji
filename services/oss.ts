import OSS from 'ali-oss';

let client: OSS | null = null;
let currentConfig: any = null;

export const getOSSClient = () => {
  return client;
};

export const updateOSSConfig = (config: {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
}) => {
  if (JSON.stringify(config) === JSON.stringify(currentConfig) && client) {
    return client;
  }

  const hasConfig = Boolean(config.region && config.accessKeyId && config.accessKeySecret && config.bucket);
  
  if (hasConfig) {
    console.log(`>>> [DEBUG] Initializing OSS client for region: ${config.region}, bucket: ${config.bucket}`);
    client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      secure: true,
      timeout: 300000, // Increase timeout to 300s (5min)
    });
    currentConfig = config;
  } else {
    console.warn('>>> [DEBUG] OSS configuration is incomplete, client not initialized.');
    client = null;
    currentConfig = null;
  }
  
  return client;
};

// Initialize with environment variables if available
updateOSSConfig({
  region: process.env.OSS_REGION || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
});

export const testOSSConnection = async (): Promise<{ success: boolean; message: string }> => {
  const ossClient = getOSSClient();
  if (!ossClient) return { success: false, message: 'OSS configuration is missing or incomplete.' };

  try {
    // Try to list objects (limited to 1) to verify connection
    await ossClient.list({ 'max-keys': 1 }, {});
    return { success: true, message: 'Successfully connected to Alibaba Cloud OSS.' };
  } catch (error: any) {
    console.error('OSS Connection Test Error:', error);
    return { success: false, message: `OSS Connection failed: ${error.message}` };
  }
};

export const uploadToOSS = async (buffer: Buffer, filename: string, mimeType: string): Promise<string> => {
  const ossClient = getOSSClient();
  if (!ossClient) {
    console.error('>>> [DEBUG] uploadToOSS failed: OSS client is not initialized.');
    throw new Error('Alibaba Cloud OSS is not configured. Please check your environment variables.');
  }

  try {
    console.log(`>>> [DEBUG] Uploading ${filename} to OSS...`);
    const result = await ossClient.put(filename, buffer, {
      mime: mimeType,
      headers: {
        'Content-Disposition': 'inline',
        'Cache-Control': 'max-age=31536000',
      },
    });
    
    console.log(`>>> [DEBUG] OSS put result: ${JSON.stringify(result.res.status)} for ${filename}`);
    
    // Return the public URL
    // Standard ali-oss result.url is usually http, we force https
    let publicUrl = result.url;
    if (publicUrl.startsWith('http://')) {
      publicUrl = publicUrl.replace('http://', 'https://');
    }
    console.log(`>>> [DEBUG] OSS Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error('>>> [DEBUG] OSS Upload Error:', error);
    throw new Error(`Failed to upload to OSS: ${error.message}`);
  }
};

export const uploadFromBase64 = async (base64Data: string, filename: string): Promise<string> => {
  if (!base64Data.includes('base64,')) {
    throw new Error('Invalid base64 data');
  }
  const [mimePart, b64] = base64Data.split(',');
  const mimeType = mimePart.split(':')[1].split(';')[0];
  const buffer = Buffer.from(b64, 'base64');
  return uploadToOSS(buffer, filename, mimeType);
};

export const uploadFromUrl = async (url: string, filename: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  try {
    const response = await fetch(url, {
      headers: {
        'x-goog-api-key': apiKey || '',
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch from URL: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    return uploadToOSS(buffer, filename, mimeType);
  } catch (error: any) {
    console.error('Upload from URL failed:', error);
    throw error;
  }
};
