const core = require('@actions/core');
const { context } = require('@actions/github');
const { Octokit } = require('octokit');

const createReleasePage = async () => {
  const repo = 'hello-world-javascript-action';
  const owner = 'johnmarsden24';
  const token = core.getInput('token');
  const packageName = core.getInput('package-name');
  const parentDir = core.getInput('parent-dir');
  const octokit = new Octokit({ auth: token });

  const { data: workflows } = await octokit.request(
    `GET /repos/{owner}/{repo}/actions/workflows/{workflowName}/runs?status=success`,
    {
      owner,
      repo,
      workflowName: `${context.workflow}.yml`,
    }
  );

  const previousWorkFlowDate = workflows.workflow_runs[0]?.created_at;
  const shortSha = context.sha.slice(0, 7);
  const newTag = `${packageName}-release-${shortSha}`;

  const queryParams = `sha=${
    context.sha
  }&path=${`${parentDir}/${packageName}`}${
    previousWorkFlowDate ? `&since=${previousWorkFlowDate}` : ''
  }`;

  console.log({ queryParams });

  const { data: commits } = await octokit.request(
    `GET /repos/${owner}/${repo}/commits?${queryParams}`,
    {
      owner,
      repo,
    }
  );

  // console.log(JSON.stringify(commits, null, 4));

  const mappedCommits = commits
    .map(
      (parent) =>
        `- ${parent.sha} ${parent.commit.message} @${parent.author.login}`
    )
    .join('\n');

  // console.log(mappedCommits);

  const { data: markup } = await octokit.request('POST /markdown', {
    mode: 'gfm',
    context: 'JohnMarsden24/hello-world-javascript-action',
    text: mappedCommits,
  });

  await octokit.request('POST /repos/{owner}/{repo}/releases', {
    owner,
    repo,
    tag_name: newTag,
    name: newTag,
    body: markup,
  });
};

createReleasePage()
  .then(() => console.log('success!'))
  .catch((err) => {
    console.log(err.message);
    core.setFailed(err.message);
  });
