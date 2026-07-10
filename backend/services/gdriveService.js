const { google } = require('googleapis');
const pool = require('../db/pool');

/**
 * Helper to get Google Drive settings from database
 */
async function getGDriveSettings() {
  const result = await pool.query('SELECT * FROM gdrive_settings WHERE id = 1');
  return result.rows[0];
}

/**
 * Initialize Google OAuth2 Client
 */
async function getOAuth2Client(settings, redirectUri) {
  if (!settings) {
    settings = await getGDriveSettings();
  }
  if (!settings || !settings.client_id || !settings.client_secret) {
    throw new Error('Google OAuth Client ID or Client Secret is not configured.');
  }
  return new google.auth.OAuth2(
    settings.client_id,
    settings.client_secret,
    redirectUri
  );
}

/**
 * Generate Consent Screen URL
 */
async function getAuthUrl(redirectUri) {
  const settings = await getGDriveSettings();
  const oauth2Client = await getOAuth2Client(settings, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent'
  });
}

/**
 * Exchange Authorization Code for Refresh Token
 */
async function exchangeCode(code, redirectUri) {
  const settings = await getGDriveSettings();
  const oauth2Client = await getOAuth2Client(settings, redirectUri);
  
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Failed to obtain a refresh token. If you have already authorized this app, please remove it from your Google account settings first or configure custom credentials.');
  }

  // Update in database
  await pool.query(
    `UPDATE gdrive_settings SET 
      refresh_token = $1, 
      last_status = 'Connected', 
      updated_at = NOW() 
     WHERE id = 1`,
    [tokens.refresh_token]
  );

  return { success: true };
}

/**
 * Perform backup generation and upload to Google Drive
 */
async function uploadBackup() {
  const settings = await getGDriveSettings();
  if (!settings || !settings.refresh_token) {
    throw new Error('Google Drive account is not connected.');
  }

  const oauth2Client = await getOAuth2Client(settings);
  oauth2Client.setCredentials({
    refresh_token: settings.refresh_token
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Generate backup snapshot payload
  const sites = await pool.query('SELECT * FROM sites ORDER BY id ASC');
  const rooms = await pool.query('SELECT * FROM rooms ORDER BY id ASC');
  const nodes = await pool.query('SELECT * FROM nodes ORDER BY id ASC');
  const sensorData = await pool.query('SELECT * FROM sensor_data ORDER BY id ASC');
  const smtpSettings = await pool.query('SELECT * FROM smtp_settings ORDER BY id ASC');
  const scheduledReports = await pool.query('SELECT * FROM scheduled_reports ORDER BY id ASC');

  const backupPayload = {
    version: '1.1',
    generated_at: new Date().toISOString(),
    sites: sites.rows,
    rooms: rooms.rows,
    nodes: nodes.rows,
    sensor_data: sensorData.rows,
    smtp_settings: smtpSettings.rows,
    scheduled_reports: scheduledReports.rows,
  };

  const filename = `tempsense_backup_${new Date().toISOString().split('T')[0]}.json`;
  
  const fileMetadata = {
    name: filename,
    mimeType: 'application/json'
  };

  if (settings.folder_id && settings.folder_id.trim()) {
    fileMetadata.parents = [settings.folder_id.trim()];
  }

  const Readable = require('stream').Readable;
  const stream = new Readable();
  stream.push(JSON.stringify(backupPayload, null, 2));
  stream.push(null); // EOF

  const media = {
    mimeType: 'application/json',
    body: stream
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id'
    });

    // Update database log
    await pool.query(
      `UPDATE gdrive_settings SET 
        last_sync = NOW(), 
        last_status = 'Success', 
        updated_at = NOW() 
       WHERE id = 1`
    );

    return { success: true, fileId: response.data.id };
  } catch (err) {
    const errMsg = err.message || 'Upload failed';
    await pool.query(
      `UPDATE gdrive_settings SET 
        last_status = $1, 
        updated_at = NOW() 
       WHERE id = 1`,
      [`Upload failed: ${errMsg}`]
    );
    throw err;
  }
}

/**
 * Verify Google Drive authorization and folder access
 */
async function testConnection() {
  const settings = await getGDriveSettings();
  if (!settings || !settings.refresh_token) {
    throw new Error('Google Drive account is not connected.');
  }

  const oauth2Client = await getOAuth2Client(settings);
  oauth2Client.setCredentials({
    refresh_token: settings.refresh_token
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Try listing files inside folder (or root) to verify write/read permission
  let query = "mimeType = 'application/json'";
  if (settings.folder_id && settings.folder_id.trim()) {
    query += ` and '${settings.folder_id.trim()}' in parents`;
  }

  const res = await drive.files.list({
    pageSize: 1,
    q: query,
    fields: 'files(id, name)'
  });

  return { success: true, filesCount: res.data.files.length };
}

module.exports = {
  getGDriveSettings,
  getAuthUrl,
  exchangeCode,
  uploadBackup,
  testConnection
};
