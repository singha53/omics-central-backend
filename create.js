import uuid from "uuid";
import * as dynamoDbLib from "./libs/dynamodb-lib";
import { success, failure } from "./libs/response-lib";

const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME;
const ECS_TASK_DEFINITION = process.env.ECS_TASK_DEFINITION;
const ECS_TASK_VPC_SUBNET_1 = process.env.ECS_TASK_VPC_SUBNET_1;
const ECS_TASK_VPC_SUBNET_2 = process.env.ECS_TASK_VPC_SUBNET_2;

const AWS = require('aws-sdk');
const ECS = new AWS.ECS();

// const ecsApi = require('./ecs');

export async function main(event, context, callback) {
  const data = JSON.parse(event.body);
  const userID = event.requestContext.identity.cognitoIdentityId;
  const noteID = uuid.v1();
  const params = {
    TableName: process.env.tableName,
    Item: {
      userId: userID,
      noteId: noteID,
      content: data.content,
      attachment: data.attachment,
      createdAt: Date.now()
    }
  };

  try {
    console.log(event);
    runThumbnailGenerateTask(userID, noteID);

    await dynamoDbLib.call("put", params);
    return success(params.Item);
  } catch (e) {
    return failure({ status: false });
  }
}


const runThumbnailGenerateTask = (USER_ID, NOTE_ID) => {

  // run an ECS Fargate task
  const params = {
    cluster: `${ECS_CLUSTER_NAME}`,
    launchType: 'FARGATE',
    taskDefinition: `${ECS_TASK_DEFINITION}`,
    count: 1,
    platformVersion:'LATEST',
    networkConfiguration: {
      awsvpcConfiguration: {
          subnets: [
              `${ECS_TASK_VPC_SUBNET_1}`,
              `${ECS_TASK_VPC_SUBNET_2}`
          ],
          assignPublicIp: 'ENABLED'
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: 'omics-central',
          environment: [
            {
              name: 'USER_ID',
              value: `${USER_ID}`
            },
            {
              name: 'NOTE_ID',
              value: `${NOTE_ID}`
            }
          ]
        }
      ]
    }
  };
  console.log("run ECS params: " + JSON.stringify(params));

  ECS.runTask(params, function (err, data) {
      if (err) {
        console.log(`Error processing ECS Task ${params.taskDefinition}: ${err}`);
      } else {
        console.log(`ECS Task ${params.taskDefinition} started: ${JSON.stringify(data.tasks)}`);
      }
      return;
  });
  // ecsApi.runECSTask(params);
};