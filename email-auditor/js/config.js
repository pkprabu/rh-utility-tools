export const config = {
version: '1.1.0',
parameterName: 'sc_cid',
auditor: {
requiredImagePrefix: 'https://explore.redhat.com/',
validFonts: [
'RedHatText-Regular',
'Red Hat Text',
'Red Hat Display',
],
validLinkColors: [
'#ee0000',
'#0066cc',
],
ignoreList: [
'https://www.redhat.com/en/about/privacy-policy',
'https://www.redhat.com/en/contact',
'https://www.redhat.com/en/preferences',
'https://www.facebook.com/RedHatInc/',
'https://x.com/RedHat',
'https://www.linkedin.com/company/red-hat',
'https://www.youtube.com/user/RedHatVideos',
'https://explore.redhat.com/index.php/email/emailWebview',
],
dummyKeywords: [
'lorem', 'ipsum', 'dolor', 'amet', 'consectetur',
'adipiscing', 'elit', 'nullam', 'aliquam', 'purus',
'iaculis', 'viverra', 'morbi', 'sollicitudin',
'convallis', 'curabitur', 'vestibulum',
],
brandTextRules: {
redHatSpacing: { regex: /\b(Red[ ]+Hat|RedHat)\b/gi },
},
minFontSize: 11,
minLineHeight: 1.4,
maxEmailWidth: 640,
gmailClipThreshold: 102400,
unsupportedCssProperties: [
'display:flex', 'display:grid', 'display:inline-flex',
'display:inline-grid', 'position:fixed', 'position:sticky',
'animation', 'transition', 'transform',
],
placeholderImageDomains: [
'localhost', '127.0.0.1', '0.0.0.0',
'placehold.it', 'placeholder.com', 'via.placeholder.com',
'picsum.photos', 'dummyimage.com', 'loremflickr.com',
'placekitten.com', 'fakeimg.pl',
],
unsubscribeKeywords: [
'unsubscribe', 'opt-out', 'opt out', 'optout',
'manage preferences', 'email preferences',
'remove me', 'manage subscriptions',
],
physicalAddressPattern: /\b\d+\s+\w[\w\s]{2,30}(?:st(?:reet)?|ave(?:nue)?|r(?:oa)?d|blvd|boulevard|dr(?:ive)?|ln|lane|way|court|ct|pl(?:ace)?|ter(?:race)?)\b|\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b|\b\d{5}(?:-\d{4})?\b/i,
},
};
