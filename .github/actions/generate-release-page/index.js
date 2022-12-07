const core = require('@actions/core');
const { context } = require('@actions/github');
const { Octokit } = require('octokit');

const createReleasePage = async () => {
  const repo = 'hello-world-javascript-action';
  const owner = 'johnmarsden24';
  const token = core.getInput('token');
  const packageName = core.getInput('package-name');
  const octokit = new Octokit({ auth: token });

  const data = await octokit.graphql(
    `
    query GetPreviousTag($repo: String!, $owner: String!, $packageName: String!) {
      repository(name: $repo, owner: $owner) {
        refs(refPrefix: "refs/tags/", first: 1, query: $packageName, orderBy: {
        field: TAG_COMMIT_DATE,
        direction: DESC
        }) {
          nodes {
            name
          }
        }
      }
    }
  `,
    {
      repo,
      owner,
      packageName,
    }
  );

  const previousTag = repository.refs.nodes[0]?.name;

  const shortSha = context.sha.slice(0, 7);
  const newTag = `${packageName}-release-${shortSha}`;

  await octokit.request(
    `POST /repos/${owner}/${repo}/releases/generate-notes`,
    {
      owner,
      repo,
      tag_name: newTag,
      target_commitish: 'main',
      ...(previousTag & { previous_tag_name: previousTag }),
    }
  );
};

createReleasePage()
  .then(() => console.log('success!'))
  .catch((err) => {
    console.log(err.message);
    core.setFailed(err.message);
  });
