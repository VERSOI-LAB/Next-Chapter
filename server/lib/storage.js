const { supabaseAdmin } = require('./supabase');

const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function uploadFile(bucket, path, file) {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

  if (error) throw new Error(error.message);
  return path;
}

async function getSignedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) return null;
  return data.signedUrl;
}

async function getSignedUrls(bucket, paths) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return {};

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrls(valid, SIGNED_URL_TTL);

  if (error) return {};

  const map = {};
  data.forEach((entry) => {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  });
  return map;
}

async function removeFile(bucket, path) {
  if (!path) return;
  await supabaseAdmin.storage.from(bucket).remove([path]);
}

module.exports = { uploadFile, getSignedUrl, getSignedUrls, removeFile };
