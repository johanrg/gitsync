(function () {

    'use strict';

    const nodeExec = require('child_process').exec;
    const nodeFs = require('fs');
    const nodePath = require('path');
    const colors = require('colors');

    /**
     * @param string rootDirectory, path to directory containing sub directories with repositories.
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
     * @param string gitDirectory containing a valid path to a .git directory.
     * @returns nothing
     */
    function verifyAndUpdateRepository(gitDirectory) {
        let workDirectory = gitDirectory.slice(0, -4);
        let run = 'git --git-dir ' + gitDirectory + ' fetch';
        let ahead = 0;
        let behind = 0;

        nodeExec(run, (error, stdOut, stdErr) => {
            let run;
            let message = '';
            if (error === null) {
                message = 'Checking ' + workDirectory.green + '... ';

                run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' rev-list --count origin/develop..develop';
                nodeExec(run, (error, stdOut, stdErr) => {
                    if (error) {
                        console.log(message + '[ahead error (no develop branch?)]'.red);
                    } else {
                        ahead = parseInt(stdOut);
                        if (ahead > 0) {
                            message += '[ahead: ' + ahead + ']';
                        }
                        run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' rev-list --count develop..origin/develop';
                        nodeExec(run, (error, stdOut, stdErr) => {
                            if (error) {
                                console.log(message + '[behind error]'.red);
                            } else {
                                behind = parseInt(stdOut);
                                if (behind > 0) {
                                    message += '[behind: ' + behind + ']';
                                }
                                if (ahead === 0 && behind > 0) {
                                    message += '[merging]'.yellow;

                                    run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' merge --ff-only @{u}';
                                    nodeExec(run, (error, stdOUt, stdErr) => {
                                        if (error) {
                                            message += '[merge error (local changes?)]'.red;
                                        } else {
                                            message += '[success]';
                                        }
                                    });
                                } else if (ahead > 0 && behind === 0) {
                                    message += '[pushing]'.blue;
                                    run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' push';
                                    nodeExec(run, (error, stdOUt, stdErr) => {
                                        if (error) {
                                            message += '[push error]'.red;
                                        } else {
                                            message += '[success]';
                                        }
                                    });
                                } else if (ahead > 0 && behind > 0) {
                                    message += '[manual merge/rebase needed]'.magenta;
                                } else {
                                    message += '[ok]';
                                }
                                console.log(message);
                            }
                        });
                    }
                });
            }
        });
    }

    let directories = getGitRepositories('/home/johan/projects/stena');
    if (directories.length > 0) {
        directories.forEach(verifyAndUpdateRepository);
    } else {
        console.log('No git repos in the path.');
    }

} ())