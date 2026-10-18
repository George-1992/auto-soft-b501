import PullToRefresh from 'pulltorefreshjs';

let startedNearTop = false;
window.addEventListener('touchstart', e => {
    startedNearTop = e.touches[0].clientY < 250;
}, { passive: true });
PullToRefresh.init({
    mainElement: 'body',
    shouldPullToRefresh() {
        const el = document.scrollingElement || document.documentElement;
        return el.scrollTop <= 0 && startedNearTop;
    },
    onRefresh() {
        window.location.reload();
    },
    distThreshold: 75,
    distMax: 80,
    instructionsPullToRefresh: 'Pull down to refresh',
    instructionsReleaseToRefresh: 'Release to refresh',
    instructionsRefreshing: 'Refreshing...',
});
