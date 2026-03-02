import { action, query } from "./_generated/server";
import { v } from "convex/values";

// R2 bucket configuration from environment variables
const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "negosyo-digital";
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
};

// HMAC-SHA256 helper
const hmacSha256 = async (
  key: string | ArrayBuffer,
  data: string
): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const keyBuffer = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
};

// SHA-256 hash helper
const sha256 = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Generate AWS Signature V4 presigned URL
const generatePresignedUrl = async (
  method: string,
  fileKey: string,
  contentType: string | null,
  config: ReturnType<typeof getR2Config>,
  expiresIn: number = 3600
): Promise<string> => {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const region = "auto";
  const service = "s3";
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucketName}/${fileKey}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;

  // Build query parameters
  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresIn.toString(),
    "X-Amz-SignedHeaders": "host",
  };

  if (contentType && method === "PUT") {
    queryParams["X-Amz-SignedHeaders"] = "content-type;host";
  }

  // Create canonical query string (sorted)
  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  // Create canonical headers
  let canonicalHeaders = `host:${host}\n`;
  let signedHeaders = "host";
  if (contentType && method === "PUT") {
    canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    signedHeaders = "content-type;host";
  }

  // Create canonical request
  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  // Create string to sign
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Calculate signature
  const kDate = await hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `https://${host}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
};

// Generate unique file key
const generateFileKey = (folder: string, filename: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const ext = filename.split(".").pop() || "bin";
  return `${folder}/${timestamp}-${randomId}.${ext}`;
};

// Generate presigned URL for uploading
export const generateUploadUrl = action({
  args: {
    folder: v.string(), // "images", "videos", "audio"
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const config = getR2Config();
    const fileKey = generateFileKey(args.folder, args.filename);

    const uploadUrl = await generatePresignedUrl(
      "PUT",
      fileKey,
      args.contentType,
      config,
      3600
    );

    // Public URL for accessing the file after upload
    const publicUrl = config.publicUrl
      ? `${config.publicUrl}/${fileKey}`
      : `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${fileKey}`;

    return {
      uploadUrl,
      fileKey,
      publicUrl,
    };
  },
});

// Get a presigned S3 URL for media streaming (video/audio).
// Unlike getSignedUrl, this ALWAYS uses the S3 endpoint with auth params,
// because the r2.dev public URLs don't support HTTP range requests
// required by media players.
export const getStreamableUrl = query({
  args: { fileKey: v.string() },
  handler: async (ctx, args) => {
    if (!args.fileKey) return null;
    if (args.fileKey.startsWith("http")) return args.fileKey;

    const config = getR2Config();
    return await generatePresignedUrl("GET", args.fileKey, null, config, 3600);
  },
});

// Get signed URL for viewing/downloading
export const getSignedUrl = query({
  args: { fileKey: v.string() },
  handler: async (ctx, args) => {
    // If it's already a full URL, return it
    if (args.fileKey.startsWith("http")) {
      return args.fileKey;
    }

    const config = getR2Config();

    // Use public URL if configured
    if (config.publicUrl) {
      return `${config.publicUrl}/${args.fileKey}`;
    }

    return await generatePresignedUrl("GET", args.fileKey, null, config, 3600);
  },
});

// Get multiple signed URLs
export const getMultipleSignedUrls = query({
  args: { fileKeys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const config = getR2Config();

    return Promise.all(
      args.fileKeys.map(async (fileKey) => {
        if (!fileKey) return null;
        if (fileKey.startsWith("http")) return fileKey;

        if (config.publicUrl) {
          return `${config.publicUrl}/${fileKey}`;
        }

        try {
          return await generatePresignedUrl("GET", fileKey, null, config, 3600);
        } catch {
          return null;
        }
      })
    );
  },
});

// Get URL - handles both R2 keys and legacy Convex storage IDs
export const getFileUrl = query({
  args: { fileKeyOrStorageId: v.string() },
  handler: async (ctx, args) => {
    const value = args.fileKeyOrStorageId;

    // Already a URL
    if (value.startsWith("http")) {
      return value;
    }

    // R2 file key (contains slash)
    if (value.includes("/")) {
      const config = getR2Config();
      if (config.publicUrl) {
        return `${config.publicUrl}/${value}`;
      }
      return await generatePresignedUrl("GET", value, null, config, 3600);
    }

    // Legacy Convex storage ID
    const cleanId = value.startsWith("convex:")
      ? value.replace("convex:", "")
      : value;
    return await ctx.storage.getUrl(cleanId);
  },
});
