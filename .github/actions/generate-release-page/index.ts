import { $, chalk } from 'zx';
import { Octokit } from '@octokit/core';
import { RequestError } from '@octokit/request-error';
import { getInput } from '@actions/core';

$.verbose = false;

export const getCommitMessage = async (sha: string): Promise<string> =>
  (await $`git log --format=%s -n 1 ${sha}`).toString().trim();

export const getHeadShortHash = async (): Promise<string> =>
  (await $`git rev-parse --short HEAD`).toString().trim();

export const getLatestReleaseTag = async (
  tagPrefix: string = '',
  offset: number = 1
): Promise<string> =>
  (
    await $`git tag -l "${
      typeof tagPrefix === 'undefined' ? 'frontend-' : `${tagPrefix}-`
    }release-*" --sort=-creatordate | tail -n +${offset} | (head -n 1 ; dd of=/dev/null) 2>/dev/null`
  )
    .toString()
    .trim();

/**
 * Returns the filenames modified in a given commit SHA.
 */
export const getFilesChangedInCommit = async (
  sha: string,
  filterDir: string = 'packages'
): Promise<string[]> =>
  (await $`git show --name-only --pretty="format:" ${sha}`)
    .toString()
    .split('\n')
    .filter((f) =>
      [`${filterDir}/`, '.github/'].includes(f.substr(0, filterDir.length + 1))
    );

const hydrateCommit = async (commit: Record<string, any>, baseDir: string) => {
  commit.files = await getFilesChangedInCommit(commit.sha, baseDir);
  commit.message = await getCommitMessage(commit.sha);
  return commit;
};

const commitsSinceLatestRelease = async (tagPrefix: string, baseDir: string) =>
  $`git log ${await getLatestReleaseTag(
    tagPrefix
  )}...${await getLatestReleaseTag(
    tagPrefix,
    2
  )} --oneline --pretty=format:'{"sha":"%H","author":"%aN <%aE>","date":"%ad","message":null,"files":[]}' -- ../../${baseDir}/ ../../.github/workflows/`;

const createReleasePage = async (tag: string, body: string) => {
  const token = getInput('github-token');
  const octokit: Octokit = new Octokit({ auth: token });
  try {
    await octokit.request('POST /repos/{owner}/{repo}/releases', {
      owner: 'lego-shop',
      repo: 'octan',
      name: tag,
      tag_name: tag,
      body: body,
      draft: false,
    });
  } catch (e) {
    process.stderr.write(`${chalk.red('error creating release page')}: `);
    if (e instanceof RequestError && e.status === 422) {
      console.log('the release page already exists');
    } else if (e instanceof Error) {
      console.log(e.message);
    }
  }
};

void (async (): Promise<void> => {
  console.log(chalk.blue('Generating release page...'));

  const baseDir = getInput('parent-directory');
  const pkg = getInput('package-directory');

  try {
    const latestCommits = await commitsSinceLatestRelease(pkg, baseDir);
    const latestReleaseTag = await getLatestReleaseTag(pkg);

    if (baseDir === 'services' && latestCommits.toString() === '') {
      return await createReleasePage(
        latestReleaseTag,
        `## ${pkg}\n\n*The service is now CD! :tada:`
      );
    }

    const commits: Record<string, any>[] = await Promise.all(
      latestCommits
        .toString()
        .split('\n')
        .map(async (c) => {
          const commit = JSON.parse(c);
          return await hydrateCommit(commit, baseDir);
        })
    );

    const commitsGroupedByPackage: Record<string, Array<object>> = {};
    const shaLength = (await getHeadShortHash()).length;

    commits.forEach((commit) => {
      const packageNames = commit.files.map(
        (file: string) => file.split('/')[1]
      );
      const uniquePackages = packageNames.filter(
        (packageName: string, i: number, ar: Array<string>) =>
          ar.indexOf(packageName) === i
      );
      uniquePackages.forEach((uniquePackage: string) => {
        if (typeof pkg === 'undefined' || uniquePackages.includes(pkg)) {
          if (!commitsGroupedByPackage.hasOwnProperty(uniquePackage)) {
            commitsGroupedByPackage[uniquePackage] = [commit];
          } else {
            commitsGroupedByPackage[uniquePackage].push(commit);
          }
        }
      });
    });

    const createMarkdown = (packageCommits: Record<string, any>) => {
      let releasePage: string = '';
      for (const [packageName, groupedCommits] of Object.entries(
        packageCommits
      )) {
        releasePage += `\n## ${packageName}\n\n`;
        groupedCommits.forEach((commit: Record<string, string>) => {
          releasePage += `* ${commit.sha.substring(0, shaLength)} ${
            commit.message
          }\n`;
        });
      }
      return releasePage;
    };
    const releasePage = createMarkdown(commitsGroupedByPackage);
    console.log('Release Page Generated', releasePage);

    await createReleasePage(latestReleaseTag, releasePage);
  } catch (e) {
    console.error('Error creating release page', e);
    process.exit(1);
  }
})();

// const core = require('@actions/core');
// const { context } = require('@actions/github');
// const { Octokit } = require('octokit');

// const repo = 'hello-world-javascript-action';
// const owner = 'johnmarsden24';
// const token = core.getInput('token');
// const packageName = core.getInput('package-name');
// const parentDir = core.getInput('parent-dir');
// const shortSha = context.sha.slice(0, 7);
// const newTag = `${packageName}-release-${shortSha}`;

// const octokit = new Octokit({ auth: token });

// const getLatestWorkflow = async () => {
//   const { data: workflows } = await octokit.request(
//     `GET /repos/{owner}/{repo}/actions/workflows/{workflowName}/runs?per_page=1`,
//     {
//       owner,
//       repo,
//       workflowName: `${context.workflow}.yml`,
//     }
//   );
//   const previousWorkFlowDate = workflows.workflow_runs[0]?.created_at;

//   return previousWorkFlowDate;
// };

// const getCommitsSinceLastWorkflow = async (previousWorkFlowDate) => {
//   const queryParams = `sha=${
//     context.sha
//   }&path=${`${parentDir}/${packageName}`}${
//     previousWorkFlowDate ? `&since=${previousWorkFlowDate}` : ''
//   }`;

//   const { data: commits } = await octokit.request(
//     `GET /repos/${owner}/${repo}/commits?${queryParams}`,
//     {
//       owner,
//       repo,
//     }
//   );

//   return commits;
// };

// const createMarkup = async (commits) => {
//   const mappedCommits = commits
//     .map(
//       (parent) =>
//         `- ${parent.sha} ${parent.commit.message} @${parent.author.login}`
//     )
//     .join('\n');

//   const { data: markup } = await octokit.request('POST /markdown', {
//     mode: 'gfm',
//     context: 'JohnMarsden24/hello-world-javascript-action',
//     text: mappedCommits,
//   });

//   return markup;
// };

// const createReleasePage = async (markup) => {
//   await octokit.request('POST /repos/{owner}/{repo}/releases', {
//     owner,
//     repo,
//     tag_name: newTag,
//     name: newTag,
//     body: markup,
//   });
// };

// getLatestWorkflow()
//   .then((previousWorkflowDate) =>
//     getCommitsSinceLastWorkflow(previousWorkflowDate)
//   )
//   .then((commits) => createMarkup(commits))
//   .then((markup) => createReleasePage(markup))
//   .catch((err) => {
//     console.log(err.message);
//     core.setFailed(err.message);
//   });
