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

  // Sales-specific export with theme styling, mini tables for multi-item sales, and conditional coloring
  async function salesToXlsx(rawSalesData, summaryData = {}) {
    try {
      if (typeof ExcelJS === 'undefined') {
        console.warn('ExcelJS not available, using SheetJS fallback');
        const exportData = rawSalesData.map(s => ({
          Date: s.Date,
          Items: s.Items,
          'Total Sales': s['Total Sales'],
          COGS: s.COGS,
          'Gross Profit': s['Gross Profit'],
          'Net Profit': s['Net Profit']
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sales');
        const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        CM.utils.downloadBlob(blob, getFilename('Sales'));
        return;
      }

      const theme = getThemeColors();
      const primaryColor = cleanHex(theme.primary);
      const dangerColor = cleanHex(theme.danger);
      const lightGreenColor = 'FFA5D5A5';  // Light green for positive profit
      const darkRedColor = 'FFDC2626';    // Dark red for negative profit (loss)
      const muteColor = 'FFF3F4F6';       // Muted background for mini table
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales');
      
      // Add headers
      const headers = ['Date', 'Items/Services', 'Total Sales', 'COGS', 'Gross Profit', 'Net Profit'];
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
      headerRow.height = 25;
      
      let currentRow = 2;
      
      // Add data rows with mini tables for multi-item sales
      rawSalesData.forEach((item) => {
        const itemsData = item._itemsData || [];
        const hasMultiple = itemsData.length > 1;
        
        // Main row
        const mainRow = worksheet.getRow(currentRow);
        mainRow.values = [
          item.Date,
          item.Items,
          item['Total Sales'],
          item.COGS,
          item['Gross Profit'],
          item['Net Profit']
        ];
        
        // Format main row
        mainRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
          cell.font = { size: 11 };
          
          // Conditional coloring for profit columns
          if (colNumber === 5) { // Gross Profit
            const value = item['Gross Profit'];
            if (value > 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreenColor } };
              cell.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            } else if (value < 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkRedColor } };
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            }
          } else if (colNumber === 6) { // Net Profit
            const value = item['Net Profit'];
            if (value > 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreenColor } };
              cell.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            } else if (value < 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkRedColor } };
              cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            }
          }
          
          // Format number columns
          if (colNumber >= 3 && colNumber <= 6) {
            cell.numFmt = '0.00';
          }
        });
        currentRow++;
        
        // Add mini table rows if multiple items
        if (hasMultiple) {
          // Mini table header
          const miniHeaderRow = worksheet.getRow(currentRow);
          miniHeaderRow.values = ['Item/Service', 'Total Sales', 'COGS', 'Gross Profit', 'Net Profit', '', ''];
          miniHeaderRow.eachCell((cell, colNumber) => {
            if (colNumber <= 5) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: muteColor } };
              cell.font = { bold: true, size: 10, color: { argb: 'FF6b7280' } };
              cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
              cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            }
          });
          currentRow++;
          
          // Mini table data rows
          itemsData.forEach(itemDetail => {
            const itemCost = itemDetail.purchasePrice || 0;
            const itemSales = itemDetail.quantity * itemDetail.price;
            const itemCogs = itemDetail.quantity * itemCost;
            const itemGrossProfit = itemSales - itemCogs;
            const itemNetProfit = itemGrossProfit;
            
            const miniDataRow = worksheet.getRow(currentRow);
            miniDataRow.values = [
              `${itemDetail.name} (x${itemDetail.quantity})`,
              itemSales,
              itemCogs,
              itemGrossProfit,
              itemNetProfit,
              '',
              ''
            ];
            
            miniDataRow.eachCell((cell, colNumber) => {
              if (colNumber <= 5) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: muteColor } };
                cell.font = { size: 10 };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                
                // Center align for numbers
                if (colNumber >= 2 && colNumber <= 5) {
                  cell.alignment = { horizontal: 'right', vertical: 'center' };
                } else {
                  cell.alignment = { horizontal: 'left', vertical: 'center' };
                }
                
                // Conditional coloring for mini table profit columns
                if (colNumber === 4) { // Gross Profit
                  if (itemGrossProfit > 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreenColor } };
                    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
                  } else if (itemGrossProfit < 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkRedColor } };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                  }
                } else if (colNumber === 5) { // Net Profit
                  if (itemNetProfit > 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreenColor } };
                    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
                  } else if (itemNetProfit < 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkRedColor } };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                  }
                }
                
                // Format number columns
                if (colNumber >= 2 && colNumber <= 5) {
                  cell.numFmt = '0.00';
                }
              }
            });
            currentRow++;
          });
        }
      });
      
      // Add summary card on the right side
      if (Object.keys(summaryData).length > 0) {
        const summaryStartRow = 2;
        const summaryCol = 8; // Column H
        
        // Summary title
        const titleCell = worksheet.getCell(summaryStartRow, summaryCol);
        titleCell.value = 'SUMMARY';
        titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
        titleCell.alignment = { horizontal: 'center', vertical: 'center' };
        titleCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        
        let summaryRow = summaryStartRow + 1;
        const summaryItems = [
          { label: 'Total Sales', value: summaryData.totalSales || 0 },
          { label: 'COGS + Expenses', value: summaryData.expensesPlusCogs || 0 },
          { label: 'Gross Profit', value: summaryData.grossProfit || 0, isProfit: true },
          { label: 'Net Profit', value: summaryData.netProfit || 0, isProfit: true }
        ];
        
        summaryItems.forEach(item => {
          // Label cell
          const labelCell = worksheet.getCell(summaryRow, summaryCol);
          labelCell.value = item.label;
          labelCell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
          labelCell.alignment = { horizontal: 'left', vertical: 'center' };
          labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          labelCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
          
          // Value cell
          const valueCell = worksheet.getCell(summaryRow, summaryCol + 1);
          valueCell.value = item.value;
          valueCell.numFmt = '0.00';
          valueCell.font = { bold: true, size: 11 };
          valueCell.alignment = { horizontal: 'right', vertical: 'center' };
          valueCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
          
          // Apply conditional coloring
          if (item.isProfit) {
            if (item.value > 0) {
              valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreenColor } };
              valueCell.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
            } else if (item.value < 0) {
              valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: darkRedColor } };
              valueCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            }
          } else {
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          }
          
          summaryRow++;
        });
      }
      
      // Set column widths
      worksheet.columns[0].width = 18; // Date
      worksheet.columns[1].width = 25; // Items
      worksheet.columns[2].width = 15; // Total Sales
      worksheet.columns[3].width = 15; // COGS
      worksheet.columns[4].width = 18; // Gross Profit
      worksheet.columns[5].width = 18; // Net Profit
      worksheet.columns[7].width = 20; // Summary label
      worksheet.columns[8].width = 15; // Summary value
      
      // Add autofilter to header row
      worksheet.autoFilter = {
        from: 'A1',
        to: { row: 1, column: 6 }
      };
      
      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      CM.utils.downloadBlob(blob, getFilename('Sales'));
      
      console.log('Sales exported with ExcelJS successfully');
    } catch (err) {
      console.error('Sales export failed:', err);
      throw err;
    }
  }

  // Expense-specific export with theme styling (matches inventory format)
  async function expensesToXlsx(data) {
    try {
      if (typeof ExcelJS === 'undefined') {
        console.warn('ExcelJS not available, using SheetJS fallback');
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        const out = XLSX.write(wb, { bookType:'xlsx', type:'array' });
        const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        CM.utils.downloadBlob(blob, getFilename('Expenses'));
        return;
      }

      const theme = getThemeColors();
      const primaryColor = cleanHex(theme.primary);
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Expenses');
      
      // Add headers
      const headers = data.length > 0 ? Object.keys(data[0]) : ['Date', 'Description', 'Amount'];
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
      headerRow.height = 25;
      
      // Add data rows
      data.forEach((item) => {
        const row = worksheet.addRow(headers.map(h => item[h]));
        
        // Add borders and format
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { horizontal: colNumber === headers.length ? 'right' : 'left', vertical: 'center', wrapText: true };
          cell.font = { size: 11 };
          
          // Format amount column as currency
          if (headers[colNumber - 1] === 'Amount' || headers[colNumber - 1] === 'Total') {
            cell.numFmt = '0.00';
            cell.font = { bold: true, size: 11 };
          }
        });
      });
      
      // Set column widths
      headers.forEach((header, idx) => {
        if (header === 'Date') {
          worksheet.columns[idx].width = 18;
        } else if (header === 'Description') {
          worksheet.columns[idx].width = 30;
        } else if (header === 'Amount' || header === 'Total') {
          worksheet.columns[idx].width = 15;
        } else {
          worksheet.columns[idx].width = Math.max(header.length + 2, 18);
        }
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
      CM.utils.downloadBlob(blob, getFilename('Expenses'));
      
      console.log('Expenses exported with ExcelJS successfully');
    } catch (err) {
      console.error('Expenses export failed:', err);
      throw err;
    }
  }

  // Dashboard export with data on left and charts on right
  async function dashboardToXlsx(salesData, summaryMetrics, inventoryStats) {
    try {
      if (typeof ExcelJS === 'undefined') {
        console.warn('ExcelJS not available for dashboard export');
        return;
      }

      const theme = getThemeColors();
      const primaryColor = cleanHex(theme.primary);
      const dangerColor = cleanHex(theme.danger);
      const successColor = 'FF10b981';
      const warningColor = 'FFF59e0b';
      const infoColor = 'FF3b82f6';

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Dashboard');
      
      // Set page setup for better printing
      worksheet.pageSetup = {
        paperSize: 9,  // A4 paper size (9 = A4)
        orientation: 'landscape',
        fitToPage: true,
        fitToHeight: 1,
        fitToWidth: 2
      };

      // Title
      worksheet.mergeCells('A1:E1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'Dashboard Report';
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF' + primaryColor.toUpperCase() } };
      titleCell.alignment = { horizontal: 'center', vertical: 'center' };
      worksheet.getRow(1).height = 25;

      // Date generated
      worksheet.mergeCells('A2:E2');
      const dateCell = worksheet.getCell('A2');
      dateCell.value = `Generated: ${new Date().toLocaleString('en-IN')}`;
      dateCell.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
      dateCell.alignment = { horizontal: 'center' };

      // ===== LEFT SIDE: DATA =====
      let row = 4;

      // Summary Metrics Section
      worksheet.mergeCells(`A${row}:C${row}`);
      const metricsTitle = worksheet.getCell(`A${row}`);
      metricsTitle.value = 'Summary Metrics';
      metricsTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      metricsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
      metricsTitle.alignment = { horizontal: 'center', vertical: 'center' };
      worksheet.getRow(row).height = 20;
      row++;

      // Summary metrics data
      const metricsData = [
        ['Metric', 'Amount (₹)', ''],
        ['Total Sales', summaryMetrics.totalSales || 0, ''],
        ['COGS', summaryMetrics.cogs || 0, ''],
        ['Expenses', summaryMetrics.expenses || 0, ''],
        ['Gross Profit', summaryMetrics.grossProfit || 0, ''],
        ['Net Profit', summaryMetrics.netProfit || 0, '']
      ];

      metricsData.forEach((data, idx) => {
        const cells = [worksheet.getCell(`A${row}`), worksheet.getCell(`B${row}`), worksheet.getCell(`C${row}`)];
        cells[0].value = data[0];
        cells[1].value = data[1];
        
        if (idx === 0) {
          // Header row
          cells.forEach(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
            cell.alignment = { horizontal: 'center' };
          });
        } else {
          // Data rows with alternating colors
          cells[0].font = { bold: true };
          cells[1].numFmt = '₹#,##0.00';
          cells[1].alignment = { horizontal: 'right' };
          
          if (idx % 2 === 0) {
            cells.forEach(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } });
          }
        }
        
        cells.forEach(cell => {
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        row++;
      });

      row += 2;

      // Inventory Status Section
      worksheet.mergeCells(`A${row}:C${row}`);
      const invTitle = worksheet.getCell(`A${row}`);
      invTitle.value = 'Inventory Status';
      invTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      invTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
      invTitle.alignment = { horizontal: 'center', vertical: 'center' };
      worksheet.getRow(row).height = 20;
      row++;

      const invData = [
        ['Item', 'Value (₹)', ''],
        ['Total Inventory Value Left', inventoryStats.totalStockValue || 0, ''],
        ['Total Stock Sold (Value)', inventoryStats.totalSoldValue || 0, '']
      ];

      invData.forEach((data, idx) => {
        const cells = [worksheet.getCell(`A${row}`), worksheet.getCell(`B${row}`), worksheet.getCell(`C${row}`)];
        cells[0].value = data[0];
        cells[1].value = data[1];
        
        if (idx === 0) {
          cells.forEach(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
            cell.alignment = { horizontal: 'center' };
          });
        } else {
          cells[0].font = { bold: true };
          cells[1].numFmt = '₹#,##0.00';
          cells[1].alignment = { horizontal: 'right' };
          
          if (idx % 2 === 0) {
            cells.forEach(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } });
          }
        }
        
        cells.forEach(cell => {
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        row++;
      });

      row += 2;

      // Recent Sales Section
      worksheet.mergeCells(`A${row}:C${row}`);
      const salesTitle = worksheet.getCell(`A${row}`);
      salesTitle.value = 'Recent Sales (Top 10)';
      salesTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      salesTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
      salesTitle.alignment = { horizontal: 'center', vertical: 'center' };
      worksheet.getRow(row).height = 20;
      row++;

      const salesHeaders = ['Date', 'Items', 'Total (₹)'];
      salesHeaders.forEach((header, idx) => {
        const cell = worksheet.getCell(row, idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryColor.toUpperCase() } };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      row++;

      salesData.slice(0, 10).forEach((sale, idx) => {
        worksheet.getCell(row, 1).value = sale.Date || '';
        worksheet.getCell(row, 2).value = sale.Items || '';
        worksheet.getCell(row, 3).value = sale.Total || 0;
        
        const cells = [worksheet.getCell(row, 1), worksheet.getCell(row, 2), worksheet.getCell(row, 3)];
        cells.forEach((cell, i) => {
          if (i === 2) {
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { horizontal: 'right' };
          } else {
            cell.alignment = { horizontal: 'left' };
          }
          
          if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
          }
          
          cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        
        row++;
      });

      // Set column widths for data section
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(2).width = 20;
      worksheet.getColumn(3).width = 5;

      // ===== RIGHT SIDE: CHARTS =====
      // Capture and embed chart images
      const summaryChartCanvas = document.getElementById('summaryChart');
      const inventoryChartCanvas = document.getElementById('inventoryChart');
      const salesChartCanvas = document.getElementById('salesChart');

      // Add Summary Metrics Chart
      if (summaryChartCanvas) {
        try {
          const summaryImage = summaryChartCanvas.toDataURL('image/png');
          const summaryImageId = workbook.addImage({ base64: summaryImage, extension: 'png' });
          worksheet.addImage(summaryImageId, 'E4:H15');
          worksheet.getRow(4).height = 180;
        } catch (e) {
          console.warn('Could not capture summary chart:', e);
          worksheet.mergeCells('E4:H15');
          const fallback1 = worksheet.getCell('E4');
          fallback1.value = 'Summary Metrics Chart\n(See webpage for live chart)';
          fallback1.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          fallback1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      }

      // Add Inventory Status Chart
      if (inventoryChartCanvas) {
        try {
          const invImage = inventoryChartCanvas.toDataURL('image/png');
          const invImageId = workbook.addImage({ base64: invImage, extension: 'png' });
          worksheet.addImage(invImageId, 'E17:H28');
          worksheet.getRow(17).height = 200;
        } catch (e) {
          console.warn('Could not capture inventory chart:', e);
          worksheet.mergeCells('E17:H28');
          const fallback2 = worksheet.getCell('E17');
          fallback2.value = 'Inventory Status Chart\n(See webpage for live chart)';
          fallback2.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          fallback2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      }

      // Add Sales & Profit Chart
      if (salesChartCanvas) {
        try {
          const salesImage = salesChartCanvas.toDataURL('image/png');
          const salesImageId = workbook.addImage({ base64: salesImage, extension: 'png' });
          worksheet.addImage(salesImageId, 'E30:H45');
          worksheet.getRow(30).height = 250;
        } catch (e) {
          console.warn('Could not capture sales chart:', e);
          worksheet.mergeCells('E30:H45');
          const fallback3 = worksheet.getCell('E30');
          fallback3.value = 'Sales & Profit Trend Chart\n(See webpage for live chart)';
          fallback3.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          fallback3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      }

      // Set right side column widths
      worksheet.getColumn(5).width = 22;
      worksheet.getColumn(6).width = 22;
      worksheet.getColumn(7).width = 22;
      worksheet.getColumn(8).width = 22;

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      CM.utils.downloadBlob(blob, getFilename('Dashboard'));

      console.log('Dashboard exported with ExcelJS successfully');
    } catch (err) {
      console.error('Dashboard export failed:', err);
      throw err;
    }
  }

  return { toXlsx, inventoryToXlsx, salesToXlsx, expensesToXlsx, dashboardToXlsx };
})();
