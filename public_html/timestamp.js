window.displayTimestamp = function() {
    const now = new Date();
    const timestamp = now.toLocaleDateString('fr-FR') + ' ' + 
                     now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    let timestampDiv = document.querySelector('.refresh-indicator');
    
    if (!timestampDiv) {
        timestampDiv = document.createElement('div');
        timestampDiv.className = 'refresh-indicator';
        document.querySelector('.display-view')?.appendChild(timestampDiv);
    }
    
    timestampDiv.textContent = 'm.a.j : ' + timestamp;
}