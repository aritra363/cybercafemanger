window.CM = window.CM || {};

CM.exporter = (() => {
  // data = array of objects; keys become columns
  function toXlsx(filename, data, sheetName='Sheet1') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    CM.utils.downloadBlob(blob, filename.endsWith('.xlsx')?filename:`${filename}.xlsx`);
  }
  return { toXlsx };
})();
