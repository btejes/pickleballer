import { api, showToast } from './app.js';

const csvInput = document.getElementById('bp-csv-input');
if (csvInput) {
  csvInput.addEventListener('change', function(e){
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      complete: function(results){
        const emails = [];
        results.data.forEach(function(row){
          row.forEach(function(cell){
            const c = String(cell || '').trim();
            if (c && c.indexOf('@') > 0) emails.push(c);
          });
        });
        if (emails.length === 0) { showToast('No emails found in file'); return; }
        showToast('Importing ' + emails.length + ' emails...');
        api('import_csv', { emails: emails }).then(function(r){
          if (r.success) {
            showToast('Imported ' + r.imported + ', skipped ' + r.skipped);
            window.dispatchEvent(new CustomEvent('bp-subscribers-changed'));
          } else {
            showToast(r.error || 'Import failed');
          }
        });
        csvInput.value = '';
      }
    });
  });
}
