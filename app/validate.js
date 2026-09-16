(function (scope) {
  'use strict';
  function validate(data) {
    const dusun = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'unknown'];
    const string = value => typeof value === 'string' && value.trim().length > 0;
    if (!data || data.schemaVersion !== 1 || data.village !== 'Pematang Ganjang' ||
        !string(data.version) || !string(data.sourceLabel) || !Number.isFinite(Date.parse(data.importedAt)) ||
        !(data.sourceDate === null || (typeof data.sourceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.sourceDate) && Number.isFinite(Date.parse(data.sourceDate)))) ||
        !Array.isArray(data.records) || !data.records.length || data.count !== data.records.length) {
      throw new Error('Format daftar pajak tidak sesuai.');
    }
    const seen = new Set();
    for (const row of data.records) {
      if (!row || !['id', 'nop', 'name', 'address', 'status'].every(key => string(row[key])) ||
          !/^\d{2}\.\d{2}\.\d{3}\.\d{3}\.\d{3}-\d{4}\.\d$/.test(row.nop) ||
          !['year', 'land', 'building', 'amount'].every(key => Number.isSafeInteger(row[key]) && row[key] >= 0) ||
          row.year < 2000 || row.year > 2100 || row.id !== row.nop + ':' + row.year ||
          !dusun.includes(row.dusun) || seen.has(row.id)) throw new Error('Isi daftar pajak tidak valid.');
      seen.add(row.id);
    }
    return data;
  }
  scope.PajakData = { validate };
})(globalThis);
