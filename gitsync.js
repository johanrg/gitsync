(function () {

    'use strict';

    const nodeExec = require('child_process').exec;
    const nodeFs = require('fs');
    const nodePath = require('path');
    const colors = require('colors');

    // Yes, this is extremely ad hoc using text comparison for git, but I haven't found
    // a better way so far.
    const BRANCH_UP_TO_DATE = 'Din gren är à jour med';
    const CHANGES_NOT_IN_QUEUE = 'Ändringar ej i incheckningskön';
    const CHANGES_TO_COMMIT = 'Ändringar att checka in';

    /**
     * @param rootDirectory, path to directory containing sub directories with repositories.
     * @returns array with git repositories.
     */
    function getGitRepositories(rootDirectory) {
        let directoriesToReturn = [];

        function readDirectory(fromPath) {
            let files = nodeFs.readdirSync(fromPath);

            files.forEach(file => {
                let currentPath = nodePath.join(fromPath, file);
                if (nodeFs.statSync(currentPath).isDirectory()) {
                    if (file === '.git') {
                        directoriesToReturn.push(currentPath);
                    } else if (file !== 'node_modules') {
                        readDirectory(currentPath);
                    }
                }
            });
        }
        readDirectory(rootDirectory);
        return directoriesToReturn;
    }

    /**
     * @param gitDirectory containing a valid path to a .git directory.
     * @returns nothing
     */
    function verifyAndUpdateRepository(gitDirectory) {
        let workDirectory = gitDirectory.slice(0, -4);
        let run = 'git --git-dir ' + gitDirectory + ' remote update';

        nodeExec(run, function updateRepository(error, stdOut, stdErr) {
            if (error === null) {
                let run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' status -uno';
                nodeExec(run, function checkRepositoryStatus(error, stdOut, stdErr) {
                    process.stdout.write('Checking ' + workDirectory.green + ' ');

                    let upToDate = stdOut.indexOf(BRANCH_UP_TO_DATE) > -1;
                    let localChanges = stdOut.indexOf(CHANGES_NOT_IN_QUEUE) > -1;
                    localChanges = localChanges || stdOut.indexOf(CHANGES_TO_COMMIT) > -1;

                    if (!upToDate && localChanges) {
                        process.stdout.write('[need sync]'.red);
                    }
                    if (upToDate && !localChanges) {
                        process.stdout.write('[ok]');
                    }
                    if (localChanges) {
                        process.stdout.write('[uncommited files]');
                    }
                    process.stdout.write('\n');

                    if (!upToDate && !localChanges) {
                        let run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' pull';
                        nodeExec(run, function pullUpdatesFromRemote(error, stdOut, stdErr) {
                            if (error === null) {
                                console.log(stdOut);
                            } else {
                                console.log('An error occurred\n'.red + error + '\n');
                            }
                        });
                    }
                });
            }
        });
    }

    let directories = getGitRepositories('/home/johan/IdeaProjects');
    if (directories.length > 0) {
        directories.forEach(verifyAndUpdateRepository);
    } else {
        console.log('No git repos in the path.');
    }

} ())