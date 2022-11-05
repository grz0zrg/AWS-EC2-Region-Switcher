const path = require('path')
const awsCli = require('aws-cli-js')
const express = require('express')
const ping = require('ping')
const app = express()
const router = express.Router({strict: true})

const Config = require('./config')

const AwsOptions = awsCli.Options
const awsOptions = new AwsOptions()
const Aws = awsCli.Aws
const aws = new Aws(awsOptions)

app.use('/public', express.static(__dirname + '/public'))
app.use('/vpn/public', express.static(__dirname + '/public'))

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'))

const getRegionFromCode = (code) => {
  return Config.instances.regions.find((region) => {
    return (region.code === code)
  })
}

let currentInstance = {
  code: '',
  instance: '',
  state: '',
  id: '',
  ip: ''
}

const getCurrentInstance = () => {
  return new Promise((resolve, reject) => {
    const commands = []
    Config.instances.regions.forEach((region) => {
      const cmdPromise = new Promise((resolve, reject) => {
        aws.command(`ec2 describe-instances --region ${region.name} --filters "Name=instance-state-name,Values=running" "Name=tag:Name,Values=${Config.instances.nameTag}"`).then((data) => {
          if (data.object.Reservations.length) {
            data.object.Reservations.forEach((reservation) => {
              reservation.Instances.forEach((instance) => {
                resolve({
                  instance: instance,
                  code: region.code,
                  state: '',
                  id: instance.InstanceId,
                  ip: ''
                })
              })
            })
          } else {
            resolve(null)
          }
        })
      })
      commands.push(cmdPromise)
    })

    Promise.all(commands).then((result) => {
      let obj = result.find((object) => {
        return object ? true : false
      })

      if (!obj) {
        obj = {
          code: '',
          instance: '',
          state: '',
          id: '',
          ip: ''
        }
      }

      resolve(obj)
    })
  })
}

const getVPNInstances = (instanceState) => {
  return new Promise((resolve, reject) => {
    const commands = []
    Config.instances.regions.forEach((region) => {
      const cmdPromise = new Promise((resolve, reject) => {
        aws.command(`ec2 describe-instances --region ${region.name} --filters "Name=instance-state-name,Values=${instanceState}" "Name=tag:Name,Values=${Config.instances.nameTag}"`).then(
          (data) => {
            if (data.object.Reservations.length) {
              data.object.Reservations.forEach((reservation) => {
                reservation.Instances.forEach((instance) => {
                  resolve({
                    instance: instance,
                    code: region.code
                  })
                })
              })
            } else {
              resolve(null)
            }
          })
        })
      commands.push(cmdPromise)
    })

    Promise.all(commands).then((result) => {
      resolve(result)
    })
  })
}

const setCloudWatchAlarm = (instanceId, region) => {
  return aws.command(`cloudwatch put-metric-alarm --region ${region} --alarm-name "ResiliateOnInactivity" --actions-enabled --alarm-actions "arn:aws:automate:${region}:ec2:terminate" --metric-name "NetworkIn" --namespace AWS/EC2 --statistic "Sum" --period 3600 --evaluation-periods 2 --threshold 5000 --unit "Bytes" --comparison-operator "LessThanOrEqualToThreshold" --dimensions "Name=InstanceId,Value=${instanceId}"`)
}

const runInstance = (templateId, region) => {
  return aws.command(`ec2 run-instances --launch-template LaunchTemplateId=${templateId} --region ${region}`)
}

const terminateInstance = (instanceId, region) => {
  return aws.command(`ec2 terminate-instances --instance-ids ${instanceId} --region ${region}`)
}

const describeInstance = (instanceId, region) => {
  return aws.command(`ec2 describe-instances --instance-ids ${instanceId} --region ${region} --filters "Name=instance-state-name,Values=running" "Name=tag:Name,Values=${Config.instances.nameTag}"`)
}

const describeInstanceStatus = (instanceId, region) => {
  return aws.command(`ec2 describe-instance-status --instance-ids ${instanceId} --region ${region}`)
}

// setup instance region toggling routes
Config.instances.regions.forEach((region) => {
  router.get('/' + region.code, async (req, res) => {
    try {
      const instances = await getVPNInstances('running')
    
      if (instances.length) {
        for (let i = 0; i < instances.length; i += 1) {
          const instance = instances[i]
          if (instance) {
            const regionName = getRegionFromCode(instance.code).name
            await terminateInstance(instance.instance.InstanceId, regionName)
          }
        }
      }

      currentInstance = {
        code: '',
        instance: '',
        state: '',
        id: '',
        ip: ''
      }

      const newInstance = await runInstance(region.launchTemplate, region.name)
      const instanceId = newInstance.object.Instances[0].InstanceId

      currentInstance = {
        code: region.code,
        instance: '',
        state: 'waiting',
        id: instanceId,
        ip: ''
      }

      await setCloudWatchAlarm(instanceId, region.name)

      res.redirect('/')
    } catch (e) {
      console.log(e)
      res.redirect('/?error=true')
    }
  });
})

router.get('/', async (req, res) => {
  if (currentInstance.state !== 'waiting') {
    // update state
    try {
      currentInstance = await getCurrentInstance()
    } catch (e) {
      console.log(e)
    }
  }

  const pugData = Config.pug.data
  pugData.currentInstance = currentInstance
  pugData.error = (req.query.error === 'true') ? 'Error: Check server logs.' : ''

  res.render('index', pugData)
});

app.use('/', router)

app.listen(Config.server.port, () => {
  console.log(`listening on port ${Config.server.port}`)
})

const checkInstanceState = async () => {
  if (currentInstance.state === 'waiting') {
    const region = getRegionFromCode(currentInstance.code)
    
    try {
      if (Config.server.usePing) {
        // ping newly created instance to check instance is ready
        if (!currentInstance.ip) {
          // determine instance IP address first
          const instance = await describeInstance(currentInstance.id, region.name)
          if (instance.object && instance.object.Reservations.length && instance.object.Reservations[0].Instances.length) {
            const instanceObject = instance.object.Reservations[0].Instances[0]
            currentInstance.ip = instanceObject.PublicIpAddress
          }
        }

        if (currentInstance.ip) {
          const target = Config.server.instancesDomainName ? Config.server.instancesDomainName : currentInstance.ip
          const pingResult = await ping.promise.probe(target, { timeout: 5, deadline: 5 })
          if (pingResult.alive && pingResult.numeric_host === currentInstance.ip) {
            const instance = await describeInstance(currentInstance.id, region.name)
            if (instance.object && instance.object.Reservations.length && instance.object.Reservations[0].Instances.length) {
              const instanceObject = instance.object.Reservations[0].Instances[0]

              currentInstance.instance = instanceObject
              currentInstance.state = ''
            }
          }
        }
      } else {
        // use InstanceStatus property to check instance is ready
        const instance = await describeInstanceStatus(currentInstance.id, region.name)
        
        if (instance.object.InstanceStatuses.length) {
          const instanceObject = instance.object.InstanceStatuses[0]
          if (instanceObject.InstanceStatus.Status === 'ok') {
            currentInstance.instance = instanceObject
            currentInstance.state = ''
          }
        }
      }
    } catch (e) {
      console.log(e)
    }
  }

  setTimeout(checkInstanceState, Config.stateCheckIntervalMs)
}

setTimeout(checkInstanceState, Config.stateCheckIntervalMs)
