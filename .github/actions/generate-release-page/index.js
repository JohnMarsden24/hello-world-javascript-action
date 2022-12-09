const core = require('@actions/core');
const { context } = require('@actions/github');
const { Octokit } = require('octokit');

const repo = 'hello-world-javascript-action';
const owner = 'johnmarsden24';
const token = core.getInput('token');
const packageName = core.getInput('package-name');
const parentDir = core.getInput('parent-dir');
const shortSha = context.sha.slice(0, 7);
const newTag = `${packageName}-release-${shortSha}`;

console.log(JSON.stringify(token));

const octokit = new Octokit({ auth: token });

console.log(JSON.stringify(context, null, 4));

const getLatestWorkflow = async () => {
  const { data: workflows } = await octokit.request(
    `GET /repos/{owner}/{repo}/actions/workflows/{workflowName}/runs?per_page=1`,
    {
      owner,
      repo,
      workflowName: `${context.workflow}.yml`,
    }
  );
  const previousWorkFlowDate = workflows.workflow_runs[0]?.created_at;

  // console.log(JSON.stringify(workflows, null, 4));

  return previousWorkFlowDate;
};

const getCommitsSinceLastWorkflow = async (previousWorkFlowDate) => {
  const queryParams = `sha=${
    context.sha
  }&path=${`${parentDir}/${packageName}`}${
    previousWorkFlowDate ? `&since=${previousWorkFlowDate}` : ''
  }`;

  // console.log(queryParams);

  const { data: commits } = await octokit.request(
    `GET /repos/${owner}/${repo}/commits?${queryParams}`,
    {
      owner,
      repo,
    }
  );

  // console.log(JSON.stringify(commits, null, 4));

  return commits;
};

const createMarkup = async (commits) => {
  const mappedCommits = commits
    .map(
      (parent) =>
        `- ${parent.sha} ${parent.commit.message} @${parent.author.login}`
    )
    .join('\n');

  const { data: markup } = await octokit.request('POST /markdown', {
    mode: 'gfm',
    context: 'JohnMarsden24/hello-world-javascript-action',
    text: mappedCommits,
  });

  return markup;
};

const createReleasePage = async (markup) => {
  await octokit.request('POST /repos/{owner}/{repo}/releases', {
    owner,
    repo,
    tag_name: newTag,
    name: newTag,
    body: markup,
  });
};

getLatestWorkflow()
  .then((previousWorkflowDate) =>
    getCommitsSinceLastWorkflow(previousWorkflowDate)
  )
  .then((commits) => createMarkup(commits))
  .then((markup) => createReleasePage(markup))
  .catch((err) => {
    console.log(err.message);
    core.setFailed(err.message);
  });
