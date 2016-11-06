(function () {

    'use strict';

    const ChildProcess = require('child_process').exec;
    const Fs = require('fs');
    const Path = require('path');
    const Colors = require('colors');

    function parseConfig() {
        try {
            let data = Fs.readFileSync('./config.json');
            if (data) {
                return JSON.parse(data);
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }
    /**
     * @param string rootDirectory, path to directory containing sub directories with repositories.
     * @returns array with git repositories.
     */
    function getGitRepositories(rootDirectory) {
        let directoriesToReturn = [];

        function readDirectory(fromPath) {
            let files = Fs.readdirSync(fromPath);

            files.forEach(file => {
                let currentPath = Path.join(fromPath, file);
                if (Fs.statSync(currentPath).isDirectory()) {
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
        let ahead = 0;
        let behind = 0;
        let run;

        run = 'git --git-dir ' + gitDirectory + ' fetch';
        ChildProcess(run, (error, stdOut, stdErr) => {
            let message = '';
            if (error === null) {
                message = 'Checking ' + workDirectory.green + '... ';

                run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' rev-list --count origin/develop..develop';
                ChildProcess(run, function checkIfAhead(error, stdOut, stdErr) {
                    if (error) {
                        console.log(message + '[ahead error (no develop branch?)]'.red);
                    } else {
                        ahead = parseInt(stdOut);
                        if (ahead > 0) {
                            message += '[ahead: ' + ahead + ']';
                        }

                        run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' rev-list --count develop..origin/develop';
                        ChildProcess(run, function checkIfBehind(error, stdOut, stdErr) {
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
                                    ChildProcess(run, function mergeChanges(error, stdOUt, stdErr) {
                                        if (error) {
                                            message += '[merge error (local changes?)]'.red;
                                        } else {
                                            message += '[success]';
                                        }
                                    });

                                } else if (ahead > 0 && behind === 0) {
                                    message += '[pushing]'.blue;
                                    
                                    run = 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' push';
                                    ChildProcess(run, function pushLocalChanges(error, stdOUt, stdErr) {
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

    let config = parseConfig();
    if (config) {
        let directories = getGitRepositories(config.directory);
        if (directories.length > 0) {
            directories.forEach(verifyAndUpdateRepository);
        } else {
            console.log('No git repos in the path.');
        }
    } else {
        console.log('Could not read the config file.')
    }
} ())