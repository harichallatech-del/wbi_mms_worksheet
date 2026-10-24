/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('WBI Operations')
    .addItem('Fill safe defaults', 'fillWbiFormDefaults')
    .addItem('Apply form dropdowns and validation', 'applyWbiValidations')
    .addItem('Fill source reference choices', 'fillSourceReferenceChoices')
    .addSeparator()
    .addItem('Queue current form', 'queueCurrentForm')
    .addItem('Queue threshold update', 'queueThresholdUpdate')
    .addItem('Clear current form', 'clearCurrentForm')
    .addSeparator()
    .addItem('Apply filters / first page', 'applyBrowseFilters')
    .addItem('Previous page', 'previousBrowsePage')
    .addItem('Next page', 'nextBrowsePage')
    .addItem('Refresh screen lists', 'initializeWbiRoleScreens')
    .addToUi();
  try { applyWbiValidations(); fillWbiFormDefaults(); initializeWbiRoleScreens(); }
  catch (err) { reportError_(SpreadsheetApp.getActiveSheet(), err); }
}

function initializeWbiRoleScreens() {
  SpreadsheetApp.getActive().getSheets().forEach(s => {
    if (['Stock Position', 'Stock Positions', 'Manufacturing BW', 'Manufacturing HB', 'Maintenance', 'Audit Log', 'Inquiries'].includes(s.getName())) renderPage_(s, 'Apply');
    if (s.getName() === 'Stock Dashboard') renderStockDashboard_(s);
    if (s.getName() === 'Dashboard') renderDashboard_(s);
    if (s.getName() === 'Admin Settings') renderAdminSettings_(s);
  });
}
