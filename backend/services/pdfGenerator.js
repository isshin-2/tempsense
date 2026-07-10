const PDFDocument = require('pdfkit');
const pool = require('../db/pool');

/**
 * Helper to calculate stats with exact timestamps for min/max readings.
 */
function calcStatsWithTimestamps(rows, valKey) {
  let minVal = Infinity;
  let minTime = null;
  let maxVal = -Infinity;
  let maxTime = null;
  let sum = 0;
  let count = 0;

  for (const r of rows) {
    const val = r[valKey];
    if (val !== null && val !== undefined) {
      sum += val;
      count++;
      if (val < minVal) {
        minVal = val;
        minTime = r.recorded_at;
      }
      if (val > maxVal) {
        maxVal = val;
        maxTime = r.recorded_at;
      }
    }
  }

  if (count === 0) {
    return { min: '-\n', max: '-\n', avg: '-', count: 0 };
  }

  const formatTime = (t) => {
    if (!t) return '';
    const d = new Date(t);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return {
    min: `${minVal.toFixed(2)}\n(${formatTime(minTime)})`,
    max: `${maxVal.toFixed(2)}\n(${formatTime(maxTime)})`,
    avg: (sum / count).toFixed(2),
    count
  };
}

/**
 * Generate an ISO-compliant cold chain monitoring PDF report.
 *
 * @param {Object} opts - { siteId, roomId, nodeId, startDate, endDate, isInternal, excludeAlerts }
 * @param {import('express').Response} res - Optional Express response to pipe PDF into
 * @returns {Promise<Buffer|void>} - Returns buffer if isInternal is true
 */
async function generateReport(opts, res) {
  const { siteId, roomId, nodeId, startDate, endDate, isInternal, excludeAlerts, excludeOnboard } = opts;

  // Fetch organization name
  const accountRes = await pool.query('SELECT name FROM accounts ORDER BY id ASC LIMIT 1');
  const companyName = accountRes.rows.length > 0 ? accountRes.rows[0].name : 'TEMPSENSE';

  // Fetch context
  const siteRes = await pool.query('SELECT * FROM sites WHERE id = $1', [siteId]);
  const site = siteRes.rows[0] || { name: 'Unknown Site', location: '' };

  let roomName = 'All Rooms';
  if (roomId) {
    const roomRes = await pool.query('SELECT name FROM rooms WHERE id = $1', [roomId]);
    roomName = roomRes.rows[0]?.name || roomName;
  }

  let nodeName = 'All Nodes';
  if (nodeId) {
    const nodeRes = await pool.query('SELECT name FROM nodes WHERE id = $1', [nodeId]);
    nodeName = nodeRes.rows[0]?.name || nodeName;
  }

  // Query sensor data
  let query = `
    SELECT sd.*, n.name as node_name, n.device_id, r.name as room_name,
           n.temp_high, n.temp_low, n.humidity_high, n.humidity_low,
           n.t1_name, n.t2_name, n.td_name, n.humidity_name
    FROM sensor_data sd
    JOIN nodes n ON sd.node_id = n.id
    JOIN rooms r ON n.room_id = r.id
    WHERE r.site_id = $1
      AND sd.recorded_at >= $2
      AND sd.recorded_at <= $3
  `;
  if (!siteId || siteId === 'undefined' || siteId === 'null') {
    throw new Error('siteId is required');
  }
  const params = [siteId, startDate, endDate];

  if (roomId && roomId !== 'undefined' && roomId !== 'null' && roomId !== 'all') {
    query += ` AND n.room_id = $${params.length + 1}`;
    params.push(roomId);
  }
  if (nodeId && nodeId !== 'undefined' && nodeId !== 'null' && nodeId !== 'all') {
    query += ` AND sd.node_id = $${params.length + 1}`;
    params.push(nodeId);
  }

  query += ' ORDER BY sd.recorded_at ASC';

  const dataRes = await pool.query(query, params);
  const rawRows = dataRes.rows;

  // Group rows by node and apply alert filtering
  const nodesData = {};
  const filteredRows = [];

  for (const r of rawRows) {
    const alerts = [];
    if (r.t1 > r.temp_high) alerts.push('T1 High');
    if (r.t1 < r.temp_low) alerts.push('T1 Low');
    if (r.t2 > r.temp_high) alerts.push('T2 High');
    if (r.t2 < r.temp_low) alerts.push('T2 Low');
    
    if (!excludeOnboard) {
      if (r.td > r.temp_high) alerts.push('DHT High');
      if (r.td < r.temp_low) alerts.push('DHT Low');
      if (r.humidity > r.humidity_high) alerts.push('Hum High');
      if (r.humidity < r.humidity_low) alerts.push('Hum Low');
    }

    const hasBreach = alerts.length > 0;
    if (excludeAlerts && hasBreach) {
      continue; // Skip readings with breaches
    }

    filteredRows.push(r);

    const nId = r.node_id;
    if (!nodesData[nId]) {
      nodesData[nId] = {
        name: r.node_name || `Node ${r.device_id}`,
        t1_name: r.t1_name || 'DS18 #1',
        t2_name: r.t2_name || 'DS18 #2',
        td_name: r.td_name || 'DHT Temp',
        humidity_name: r.humidity_name || 'Humidity',
        rawRows: []
      };
    }
    nodesData[nId].rawRows.push(r);
  }

  // Fetch alert count
  let alertCount = 0;
  if (!excludeAlerts) {
    const alertQuery = `
      SELECT COUNT(*) as count FROM alerts a
      JOIN nodes n ON a.node_id = n.id
      JOIN rooms r ON n.room_id = r.id
      WHERE r.site_id = $1 AND a.sent_at >= $2 AND a.sent_at <= $3
    `;
    const alertRes = await pool.query(alertQuery, [siteId, startDate, endDate]);
    alertCount = alertRes.rows[0]?.count || 0;
  }

  // ===== BUILD PDF =====
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    if (isInternal) {
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    } else if (res) {
      const filename = `tempsense_report_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      doc.pipe(res);
    }

    // --- Header ---
    doc.fontSize(22).font('Helvetica-Bold').text('TEMPSENSE', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('Cold Chain Monitoring Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#666').text('ISO 22000 / HACCP / FSSAI Compliance Document', { align: 'center' });
    doc.fillColor('#000');
    doc.moveDown(1);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e40af').lineWidth(2).stroke();
    doc.moveDown(1);

    // --- Report Metadata ---
    doc.fontSize(12).font('Helvetica-Bold').text('Report Details');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');

    const meta = [
      ['Organization', companyName],
      ['Site', `${site.name} — ${site.location || 'N/A'}`],
      ['Room', roomName],
      ['Node', nodeName],
      ['Report Period', `${startDate.split('T')[0]} to ${endDate.split('T')[0]}`],
      ['Generated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
      ['Total Readings', `${filteredRows.length}`],
      ['Total Alerts Triggered', excludeAlerts ? '0 (Excluded)' : `${alertCount}`],
    ];

    for (const [label, value] of meta) {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    }
    doc.moveDown(1);

    // --- Statistical Summary Table ---
    doc.fontSize(12).font('Helvetica-Bold').text('Statistical Summary (Per Sensor)');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colWidths = [160, 100, 100, 40, 40];
    const headers = ['Sensor Parameter', 'Min (Timestamp)', 'Max (Timestamp)', 'Avg', 'Count'];
    
    const tableData = [];
    for (const nId of Object.keys(nodesData)) {
      const nd = nodesData[nId];
      const t1Stats = calcStatsWithTimestamps(nd.rawRows, 't1');
      const t2Stats = calcStatsWithTimestamps(nd.rawRows, 't2');
      const tdStats = calcStatsWithTimestamps(nd.rawRows, 'td');
      const humStats = calcStatsWithTimestamps(nd.rawRows, 'humidity');

      if (t1Stats.count > 0) tableData.push([`${nd.name} - ${nd.t1_name} (°C)`, ...Object.values(t1Stats)]);
      if (t2Stats.count > 0) tableData.push([`${nd.name} - ${nd.t2_name} (°C)`, ...Object.values(t2Stats)]);
      if (!excludeOnboard && tdStats.count > 0) tableData.push([`${nd.name} - ${nd.td_name} (°C)`, ...Object.values(tdStats)]);
      if (!excludeOnboard && humStats.count > 0) tableData.push([`${nd.name} - ${nd.humidity_name} (%)`, ...Object.values(humStats)]);
    }

    if (tableData.length === 0) {
      tableData.push(['No Parameter Data', '-', '-', '-', '-']);
    }

    // Header row
    let xPos = 50;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(50, tableTop, 440, 16).fill('#1e40af');
    doc.fillColor('#fff');
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], xPos + 4, tableTop + 4, { width: colWidths[i], align: 'left' });
      xPos += colWidths[i];
    }
    doc.fillColor('#000');

    // Data rows
    let rowY = tableTop + 16;
    doc.font('Helvetica').fontSize(7.5);
    for (let r = 0; r < tableData.length; r++) {
      // If table will overflow, add page
      if (rowY > 730) {
        doc.addPage();
        rowY = 50;
      }
      const bgColor = r % 2 === 0 ? '#f0f4ff' : '#ffffff';
      doc.rect(50, rowY, 440, 26).fill(bgColor); // Set row height to 26 to fit timestamp newlines
      doc.fillColor('#000');
      xPos = 50;
      for (let c = 0; c < tableData[r].length; c++) {
        doc.text(String(tableData[r][c]), xPos + 4, rowY + 4, { width: colWidths[c], align: 'left' });
        xPos += colWidths[c];
      }
      rowY += 26;
    }

    doc.y = rowY + 15;
    doc.moveDown(1);

    // --- Full Data Log ---
    if (filteredRows.length > 0) {
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('Data Log');
      doc.moveDown(0.5);

      // Determine dynamic headers if single node
      let logHeaders = ['Timestamp', 'Node', 'T1 °C', 'T2 °C', 'DHT °C', 'Hum %', 'Status'];
      let logWidths = [105, 80, 45, 45, 45, 45, 80];
      if (excludeOnboard) {
        logHeaders = ['Timestamp', 'Node', 'T1 °C', 'T2 °C', 'Status'];
        logWidths = [135, 110, 85, 85, 80];
      }
      if (nodeId && filteredRows.length > 0) {
        const f = filteredRows[0];
        if (excludeOnboard) {
          logHeaders = [
            'Timestamp',
            'Node',
            `${f.t1_name || 'T1'} °C`,
            `${f.t2_name || 'T2'} °C`,
            'Status'
          ];
          logWidths = [135, 110, 85, 85, 80];
        } else {
          logHeaders = [
            'Timestamp',
            'Node',
            `${f.t1_name || 'T1'} °C`,
            `${f.t2_name || 'T2'} °C`,
            `${f.td_name || 'DHT'} °C`,
            `${f.humidity_name || 'Hum'} %`,
            'Status'
          ];
          logWidths = [105, 80, 45, 45, 45, 45, 80];
        }
      }

      let ly = doc.y;
      xPos = 50;
      doc.rect(50, ly, 495, 14).fill('#1e40af');
      doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold');
      for (let i = 0; i < logHeaders.length; i++) {
        doc.text(logHeaders[i], xPos + 2, ly + 3, { width: logWidths[i] });
        xPos += logWidths[i];
      }
      doc.fillColor('#000').font('Helvetica').fontSize(7);
      ly += 14;

      const maxRows = Math.min(filteredRows.length, 500); 
      for (let i = 0; i < maxRows; i++) {
        if (ly > 750) {
          doc.addPage();
          ly = 50;
        }
        const r = filteredRows[i];
        
        const alerts = [];
        if (r.t1 > r.temp_high) alerts.push('T1 High');
        if (r.t1 < r.temp_low) alerts.push('T1 Low');
        if (r.t2 > r.temp_high) alerts.push('T2 High');
        if (r.t2 < r.temp_low) alerts.push('T2 Low');
        if (!excludeOnboard) {
          if (r.td > r.temp_high) alerts.push('DHT High');
          if (r.td < r.temp_low) alerts.push('DHT Low');
          if (r.humidity > r.humidity_high) alerts.push('Hum High');
          if (r.humidity < r.humidity_low) alerts.push('Hum Low');
        }
        const statusText = alerts.length > 0 ? alerts.join(', ') : 'Normal';

        const bg = i % 2 === 0 ? '#f8f9fa' : '#fff';
        doc.rect(50, ly, 495, 12).fill(bg);
        doc.fillColor(statusText === 'Normal' ? '#000' : '#b91c1c');
        xPos = 50;
        const vals = excludeOnboard ? [
          new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          r.node_name || `ID:${r.device_id}`,
          r.t1 !== null ? r.t1.toFixed(1) : '--',
          r.t2 !== null ? r.t2.toFixed(1) : '--',
          statusText
        ] : [
          new Date(r.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          r.node_name || `ID:${r.device_id}`,
          r.t1 !== null ? r.t1.toFixed(1) : '--',
          r.t2 !== null ? r.t2.toFixed(1) : '--',
          r.td !== null ? r.td.toFixed(1) : '--',
          r.humidity !== null ? r.humidity.toFixed(1) : '--',
          statusText
        ];
        for (let c = 0; c < vals.length; c++) {
          doc.text(vals[c], xPos + 2, ly + 2, { width: logWidths[c] });
          xPos += logWidths[c];
        }
        ly += 12;
      }
      
      if (filteredRows.length > 500) {
        doc.moveDown(1);
        doc.fontSize(8).fillColor('#666').text(`... showing first 500 of ${filteredRows.length} readings ...`, { align: 'center' });
      }
    }

    // --- Footer ---
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('Compliance Declaration');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#000');
    doc.text(
      'This report has been generated automatically by the Tempsense Cold Chain Monitoring System. ' +
      'The data is sourced directly from IoT sensor nodes. ' +
      'Supporting evidence for ISO 22000, HACCP, and FSSAI compliance.'
    );
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Authorized Signatory');
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8).text('Name & Designation');
    doc.moveDown(0.5);
    doc.text('Date: _______________________');
    doc.moveDown(2);
    doc.fontSize(7).fillColor('#999').text(`Generated by Tempsense v1.1 — ${companyName}`, { align: 'center' });

    doc.end();
    if (!isInternal && !res) resolve();
  });
}

module.exports = { generateReport };
