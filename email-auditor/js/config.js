export const config = {
parameterName: "sc_cid",
auditor: {
    requiredImagePrefix: "https://explore.redhat.com/",
    validFonts: ["RedHatText-Regular", "Red Hat Text", "Red Hat Display"],
    validLinkColors: ["rgb(238, 0, 0)", "rgb(0, 102, 204)"],
    ignoreList: [
        "https://www.redhat.com/en/about/privacy-policy", "https://www.redhat.com/en/contact",
        "https://www.redhat.com/en/preferences", "https://www.facebook.com/RedHatInc/",
        "https://x.com/RedHat", "https://www.linkedin.com/company/red-hat",
        "https://www.youtube.com/user/RedHatVideos", "https://explore.redhat.com/index.php/email/emailWebview"
    ],
    dummyKeywords: [
        'lorem', 'ipsum', 'dolor', 'amet', 'consectetur', 'adipiscing', 'elit', 'nullam', 'aliquam',
        'purus', 'iaculis', 'viverra', 'morbi', 'sollicitudin', 'convallis', 'curabitur', 'vestibulum'
    ]
}
};