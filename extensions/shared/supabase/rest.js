function getLogger(opts) {
  return opts && opts.logger ? opts.logger : null;
}

function getPrefix(opts) {
  return opts && opts.prefix ? `${opts.prefix} ` : '';
}

function logResult(logger, level, message) {
  if (!logger) return;

  if (typeof logger.appendLog === 'function') {
    logger.appendLog(level, message);
    return;
  }

  if (level === 'warn' && typeof logger.warn === 'function') {
    logger.warn(message);
    return;
  }

  if (level === 'error' && typeof logger.error === 'function') {
    logger.error(message);
    return;
  }

  if (typeof logger.log === 'function') {
    logger.log(message);
  }
}

function buildRestUrl(credentials, path) {
  return `${credentials.url.replace(/\/$/, '')}${path}`;
}

export function insertSupabaseRows(tableName, records, credentials, opts) {
  const logger = getLogger(opts);
  const prefix = getPrefix(opts);

  if (!credentials || !credentials.url || !credentials.anonKey) {
    logResult(logger, 'warn', `${prefix}missing supabase credentials`);
    return Promise.resolve({ ok: false, error: 'missing_credentials' });
  }

  const rows = Array.isArray(records) ? records : [records];
  if (rows.length === 0) {
    return Promise.resolve({ ok: true });
  }

  return fetch(buildRestUrl(credentials, `/rest/v1/${encodeURIComponent(tableName)}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: credentials.anonKey,
      Authorization: `Bearer ${credentials.anonKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(Array.isArray(records) ? records : records || {}),
  })
    .then((response) => {
      if (response.ok) {
        return { ok: true };
      }

      return response.text().then((text) => {
        logResult(
          logger,
          'warn',
          `${prefix}supabase write failed: ${tableName} ${response.status} ${text}`,
        );
        return { ok: false, error: text || `HTTP ${response.status}` };
      });
    })
    .catch((error) => {
      logResult(logger, 'warn', `${prefix}supabase request failed: ${tableName} ${String(error)}`);
      return { ok: false, error: String(error) };
    });
}

export function insertSupabaseRow(tableName, record, credentials, opts) {
  return insertSupabaseRows(tableName, record, credentials, opts);
}

export function callSupabaseRpc(rpcName, payload, credentials, opts) {
  const logger = getLogger(opts);
  const prefix = getPrefix(opts);

  if (!credentials || !credentials.url || !credentials.anonKey) {
    logResult(logger, 'warn', `${prefix}missing supabase credentials`);
    return Promise.resolve({ ok: false, error: 'missing_credentials' });
  }

  return fetch(buildRestUrl(credentials, `/rest/v1/rpc/${encodeURIComponent(rpcName)}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: credentials.anonKey,
      Authorization: `Bearer ${credentials.anonKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload || {}),
  })
    .then((response) => {
      if (response.ok) {
        return { ok: true };
      }

      return response.text().then((text) => {
        logResult(logger, 'warn', `${prefix}supabase rpc failed: ${rpcName} ${response.status} ${text}`);
        return { ok: false, error: text || `HTTP ${response.status}` };
      });
    })
    .catch((error) => {
      logResult(logger, 'warn', `${prefix}supabase rpc request failed: ${rpcName} ${String(error)}`);
      return { ok: false, error: String(error) };
    });
}

export function mergeGoodsDetailSlot(row, credentials, opts) {
  return callSupabaseRpc('merge_goods_detail_slot_log', { p_row: row }, credentials, opts);
}

export function mergeGoodsDetailSlotBatch(rows, credentials, opts) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Promise.resolve({ ok: true });
  }

  const concurrency =
    opts && typeof opts.concurrency === 'number' && opts.concurrency > 0 ? opts.concurrency : 4;

  let index = 0;
  let inFlight = 0;
  const results = [];

  return new Promise((resolve) => {
    function flush() {
      while (inFlight < concurrency && index < rows.length) {
        const currentIndex = index;
        const row = rows[currentIndex];
        index += 1;
        inFlight += 1;

        mergeGoodsDetailSlot(row, credentials, opts)
          .then((result) => {
            results[currentIndex] = result;
          })
          .catch((error) => {
            results[currentIndex] = { ok: false, error: String(error) };
          })
          .finally(() => {
            inFlight -= 1;

            if (index < rows.length) {
              flush();
              return;
            }

            if (inFlight === 0) {
              resolve({
                ok: results.every((result) => result && result.ok),
              });
            }
          });
      }

      if (index >= rows.length && inFlight === 0) {
        resolve({
          ok: results.every((result) => result && result.ok),
        });
      }
    }

    flush();
  });
}
