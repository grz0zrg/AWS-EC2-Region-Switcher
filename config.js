module.exports = {
  server: {
    port: 9000,
    stateCheckIntervalMs: 5000
  },
  // data that is passed to Pug template
  pug: {
    data: {
      regions: {
        // used for the img title tag
        uk: {
          title: 'London'
        },
        us: {
          title: 'Ohio'
        },
        au: {
          title: 'Sydney'
        },
        ca: {
          title: 'Canada'
        }
      }
    }
  },
  instances: {
    // launch template must spawn instance named like the nameTag pattern
    nameTag: 'VPN*',
    regions: [
      // add any regions here
      {
        code: 'uk', // short code for the region, used to display correct flag
        name: 'eu-west-2', // AWS region name
        launchTemplate: 'lt-001' // launch template
      },
      {
        code: 'us',
        name: 'us-east-2',
        launchTemplate: 'lt-002'
      },
      {
        code: 'au',
        name: 'ap-southeast-2',
        launchTemplate: 'lt-003'
      },
      {
        code: 'ca',
        name: 'ca-central-1',
        launchTemplate: 'lt-004'
      }
    ]
  }
}
