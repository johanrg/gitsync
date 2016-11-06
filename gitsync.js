(function () {

    'use strict';

    const ChildProcess = require('child_process').exec;
    const Fs = require('fs');
    const Path = require('path');
    const Colors = require('colors');

    /**
     * Reads config.json from the current directory.
     * 
     * @returns config object
     */
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
     * Returns all git repositories found in the rootDirectory 
     * 
     * @param rootDirectory, path to directory containing sub directories with repositories.
     * @returns array with paths to git repositories.
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
     * Creates a string with a complete git command to be executed.
     * 
     * @param command git parameters
     * @param gitDirectory path to the .git directory in the repository 
     * @returns string with the complete command to execute git
     */
    function gitCommand(command, gitDirectory) {
        let workDirectory = gitDirectory.slice(0, -4);
        return 'git --git-dir ' + gitDirectory + ' --work-tree ' + workDirectory + ' ' + command;
    }

    /**
     * Checks if a repository is synced with a remote repository, if not fast forward merges
     * or pushes changes.
     *  
     * @param gitDirectory containing a valid path to a .git directory.
     * @returns nothing
     */
    function SyncRepository(gitDirectory) {
        let ahead = 0;
        let behind = 0;
        let run;

        ChildProcess(gitCommand('fetch', gitDirectory), (error, stdOut, stdErr) => {
            let message = '';
            if (error === null) {
                message = 'Checking ' + gitDirectory.slice(0, -4).green + '... ';

                ChildProcess(gitCommand('rev-list --count origin/develop..develop', gitDirectory), (error, stdOut) => {
                    if (error) {
                        console.log(message + '[checking if ahead caused error (no develop branch?)]'.red);
                    } else {
                        ahead = parseInt(stdOut);
                        if (ahead > 0) {
                            message += '[ahead: ' + ahead + ']';
                        }

                        ChildProcess(gitCommand('rev-list --count develop..origin/develop', gitDirectory), (error, stdOut) => {
                            if (error) {
                                console.log(message + '[checking if behind caused error]'.red);
                            } else {
                                behind = parseInt(stdOut);
                                if (behind > 0) {
                                    message += '[behind: ' + behind + ']';
                                }
                                if (ahead === 0 && behind > 0) {
                                    message += '[merging]'.yellow;

                                    ChildProcess(gitCommand('merge --ff-only @{u}', gitDirectory), (error) => {
                                        if (error) {
                                            message += '[merge error (local changes?)]'.red;
                                        } else {
                                            message += '[success]';
                                        }
                                    });

                                } else if (ahead > 0 && behind === 0) {
                                    message += '[pushing]'.blue;

                                    ChildProcess(gitCommand('push', gitDirectory), (error) => {
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

    function main() {
        let config = parseConfig();
        if (config) {
            let directories = getGitRepositories(config.directory);
            if (directories.length > 0) {
                directories.forEach(SyncRepository);
            } else {
                console.log('No git repos in the path.');
            }
        } else {
            console.log('Could not read the config file.')
        }
    }

    main();

} ())