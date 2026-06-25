import { api, showToast, withSpinner, onInit } from './app.js';

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
            const range = this.quill.getSelection(true);
            this.quill.insertEmbed(range.index, 'image', url);
            this.quill.setSelection(range.index + 1);
          }
        }
      }
    }
  });
}

function pollBroadcastStatus(broadcastId) {
  let attempts = 0;
  const maxAttempts = 200;
  const poll = setInterval(function(){
    attempts++;
    if (attempts > maxAttempts) { clearInterval(poll); return; }
    api('broadcast_status', { broadcast_id: broadcastId }).then(function(r){
      if (!r.success) return;
      const status = (r.status || 'unknown').toLowerCase();
      const audience = r.audience_count ? (' (' + r.audience_count + ' contacts)') : '';
      if (status === 'sent' || status === 'delivered') {
        sendStatus.textContent = 'Sent' + audience;
        showToast('Newsletter delivered');
        clearInterval(poll);
      } else if (status === 'failed' || status === 'error') {
        sendStatus.textContent = 'Failed';
        showToast('Broadcast failed');
        clearInterval(poll);
      } else {
        sendStatus.textContent = 'Status: ' + status + audience;
      }
    }).catch(function(){});
  }, 3000);
}

sendBtn.addEventListener('click', function(){
  const subject = subjectInput.value.trim();
  const html = quill.root.innerHTML;
  if (!subject) { showToast('Subject required'); return; }
  if (!quill.getText().trim()) { showToast('Body required'); return; }
  if (!confirm('Send this newsletter to all subscribers?')) return;
  sendStatus.textContent = '';
  withSpinner(sendBtn, 'Sending...', function(){
    return api('send_newsletter', { subject: subject, html: html }).then(function(r){
      if (r.success) {
        showToast('Newsletter queued');
        subjectInput.value = '';
        quill.setText('');
        if (r.broadcast_id) {
          sendStatus.textContent = 'Status: queued';
          pollBroadcastStatus(r.broadcast_id);
        } else {
          sendStatus.textContent = r.message || 'Queued';
        }
      } else {
        sendStatus.textContent = '';
        showToast(r.error || 'Send failed');
      }
    }).catch(function(){ showToast('Send failed'); });
  });
});

onInit(function(){
  initEditor();
});
