(function(){
  const api = window.bpAdmin.api;
  const showToast = window.bpAdmin.showToast;
  const withSpinner = window.bpAdmin.withSpinner;

  const subjectInput = document.getElementById('bp-subject');
  const sendBtn = document.getElementById('bp-send-btn');
  const sendStatus = document.getElementById('bp-send-status');

  let quill;

  function initEditor() {
    if (quill) return;
    quill = new Quill('#bp-editor', {
      theme: 'snow',
      placeholder: 'Write your newsletter here...',
      modules: {
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'link'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['image'],
            ['clean']
          ],
          handlers: {
            image: function(){
              let url = prompt('Paste the image URL:');
              if (!url) return;
              url = url.trim();
              if (!/^https?:\/\//i.test(url)) { showToast('URL must start with http or https'); return; }
              let range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, 'image', url);
              this.quill.setSelection(range.index + 1);
            }
          }
        }
      }
    });
  }

  sendBtn.addEventListener('click', function(){
    const subject = subjectInput.value.trim();
    const html = quill.root.innerHTML;
    if (!subject) { showToast('Subject required'); return; }
    if (!quill.getText().trim()) { showToast('Body required'); return; }
    if (!confirm('Send this newsletter to all subscribers?')) return;
    sendStatus.textContent = '';
    const pollInterval = setInterval(function(){
      api('send_status').then(function(r){
        if (r.success && r.total > 0) sendStatus.textContent = 'Sent ' + r.sent + ' of ' + r.total;
      });
    }, 1500);
    withSpinner(sendBtn, 'Sending...', function(){
      return api('send_newsletter', { subject: subject, html: html }).then(function(r){
        clearInterval(pollInterval);
        if (r.success) {
          sendStatus.textContent = 'Sent ' + r.sent + ' of ' + r.total + (r.failed ? ', failed ' + r.failed : '');
          showToast('Newsletter sent');
          subjectInput.value = '';
          quill.setText('');
        } else {
          sendStatus.textContent = '';
          showToast(r.error || 'Send failed');
        }
      }).catch(function(){ clearInterval(pollInterval); showToast('Send failed'); });
    });
  });

  window.bpAdmin.onInit(function(){
    initEditor();
  });
})();
