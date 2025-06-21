// static/js/schedules.js
console.log('schedules.js loaded successfully (attempt 1)');

export function initSchedules() {
    console.log('initSchedules() from schedules.js called');
    const activeScheduleSelector = document.getElementById('activeScheduleSelector');
    if (activeScheduleSelector) {
        activeScheduleSelector.innerHTML = '<option>Schedules (stub)</option>';
    } else {
        // console.warn('Active schedule selector not found in initSchedules.');
    }
}

export function getActiveScheduleId() {
    // Basic stub
    const activeScheduleSelector = document.getElementById('activeScheduleSelector');
    if (activeScheduleSelector && activeScheduleSelector.value) {
        return activeScheduleSelector.value;
    }
    return null;
}

// Minimal modal opener for testing if file is loaded and accessible from HTML
window.openSchedulesModal = function() {
    console.log('window.openSchedulesModal called');
    const schedulesModal = document.getElementById('schedulesModal');
    if (schedulesModal) {
        schedulesModal.classList.remove('hidden');
        // No dependency on displayMessage or utils.js for this test
        alert('Schedules Modal Opened (minimal JS)!');
    } else {
        alert('Schedules modal HTML element not found!');
    }
}

window.closeSchedulesModal = function() {
     console.log('window.closeSchedulesModal called');
    const schedulesModal = document.getElementById('schedulesModal');
    if (schedulesModal) {
        schedulesModal.classList.add('hidden');
    }
}
