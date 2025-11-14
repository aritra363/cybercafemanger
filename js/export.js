window.CM = window.CM || {};

CM.exporter = (() => {
  // Get current theme colors
  function getThemeColors() {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    let primary = styles.getPropertyValue('--primary').trim();
    let danger = styles.getPropertyValue('--danger').trim();
    
    // Remove any extra spaces
    primary = primary.replace(/\s+/g, '');
    danger = danger.replace(/\s+/g, '');
    
    console.log('Extracted theme colors:', { primary, danger });
    
    return {
      primary: primary || '#ff006e',  // Neon pink default
      danger: danger || '#dc2626'    // Red default
    };
  }

  // Remove # from hex color
  function cleanHex(hex) {
    return (hex || '').trim().replace('#', '');
  }

  // Generate filename with page name, date, and time
  function getFilename(baseName) {
    const now = new Date();
    const date = now.toLocaleDateString('en-IN').replace(/\//g, '-'); // DD-MM-YYYY
    const time = now.toLocaleTimeString('en-IN', { hour12: false }).replace(/:/g, '-'); // HH-MM-SS
    return `${baseName}_${date}_${time}.xlsx`;
  }

  // Inventory-specific export with theme styling and low stock highlighting
  async function inventoryToXlsx(data, lowStockThreshold = 0) {
    try {
      if (typeof ExcelJS === 'undefined') {
        console.warn('ExcelJS not available, using SheetJS fallback');
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        CM.utils.downloadBlob(blob, getFilename('Inventory'));
        return;
      }

      const theme = getThemeColors();
      const primaryColor = cleanHex(theme.primary);
      const lightRedColor = 'FFC5A5A5';  // Lighter red/pink shade instead of dark red
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventory');
      
      // Add headers
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      worksheet.addRow(headers);
      
      // Style header row with theme color
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + primaryColor.toUpperCase() }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 12
        };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Add data rows
      data.forEach((item) => {
        const row = worksheet.addRow(headers.map(h => item[h]));
        
        // Add borders and format
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
          
          // Highlight low stock items with lighter red
          if (item['Stock'] !== undefined && Number(item['Stock']) <= lowStockThreshold) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: lightRedColor }
            };
            cell.font = {
              bold: true,
              color: { argb: 'FFFFFFFF' }
            };
          }
        });
      });
      
      // Set column widths
      headers.forEach((header, idx) => {
        worksheet.columns[idx].width = Math.max(header.length + 2, 18);
      });
      
      // Add autofilter to header row
      if (data.length > 0) {
        worksheet.autoFilter = {
          from: 'A1',
          to: { row: data.length + 1, column: headers.length }
        };
      }
      
      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      CM.utils.downloadBlob(blob, getFilename('Inventory'));
      
      console.log('Inventory exported with ExcelJS successfully');
    } catch (err) {
      console.error('Inventory export failed:', err);
      throw err;
    }
  }

  // Generic export function for other pages (no special styling)
  async function toXlsx(filename, data, sheetName='Sheet1', options={}) {
    try {
      if (typeof ExcelJS === 'undefined') {
        console.warn('ExcelJS not available, using SheetJS fallback');
        toXlsxSheetJS(filename, data, sheetName, options);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);
      
      // Add headers
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      worksheet.addRow(headers);
      
      // Simple header styling (no theme colors for generic export)
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Add data rows
      data.forEach((item) => {
        const row = worksheet.addRow(headers.map(h => item[h]));
        
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
        });
      });
      
      // Set column widths
      headers.forEach((header, idx) => {
        worksheet.columns[idx].width = Math.max(header.length + 2, 18);
      });
      
      // Add autofilter if requested
      if (options.addFilter && data.length > 0) {
        worksheet.autoFilter = {
          from: 'A1',
          to: { row: data.length + 1, column: headers.length }
        };
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      CM.utils.downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
      
      console.log('Exported with ExcelJS successfully');
    } catch (err) {
      console.error('ExcelJS export failed:', err);
      toXlsxSheetJS(filename, data, sheetName, options);
    }
  }

  // Fallback to SheetJS if ExcelJS fails
  function toXlsxSheetJS(filename, data, sheetName, options) {
    console.log('Using SheetJS fallback');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    CM.utils.downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  }

  return { toXlsx, inventoryToXlsx };
})();
