(function () {

    'use strict';

    const ChildProcess = require('child_process').exec;
    const Fs = require('fs');
    const Path = require('path');
    const Colors = require('colors');

    let options = {
        push: false,
        verbose: false,
    };

    /**
     * Parses command line arguments
     *
     * @returns void
     */
    function parseArguments() {
        let i = 2;
        while (process.argv[i]) {
            switch (process.argv[i]) {
                case '-push':
                    options.push = true;
                    break;

                case '-v':
                    options.verbose = true;
                    break;

                default:
                    console.log('Argument ' + process.argv[i] + ' not supported.');
                    process.exit(1);
            }
            i++;
        }
    }

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
     * Checks if a repository is synced with a remote repository, if not fast forward merge
     * or push changes if that option is enabled.
     *
     * @param gitDirectory containing a valid path to a .git directory.
     * @returns void
     */
    function SyncRepository(gitDirectory) {
        let ahead = 0;
        let behind = 0;
        let run;

        ChildProcess(gitCommand('fetch', gitDirectory), (error, stdOut, stdErr) => {
            let message = '';
            let branch = '';

            if (error === null) {
                message = 'Checking ' + gitDirectory.slice(0, -4).green + ' ';

                ChildProcess(gitCommand('symbolic-ref --short -q HEAD', gitDirectory), (error, stdOut, stdErr) => {
                    if (error) {
                        console.log(message + '[' + 'error when checking status'.red + ']');
                        if (options.verbose) {
                            console.log(error);
                        }
                    } else {
                        // remove line feed
                        if (process.platform === 'win32') {
                            branch = stdOut.slice(0, -2); // expecting /r/n on win32, but haven't tested it.
                        } else {
                            branch = stdOut.slice(0, -1);
                        }
                        message += '[' + branch.gray + ']';

                        ChildProcess(gitCommand('rev-list --count origin/' + branch + '..' + branch, gitDirectory), (error, stdOut, stdErr) => {
                            if (error) {
                                console.log(message + '[checking if ahead caused error]'.red);
                                if (options.verbose) {
                                    console.log(error);
                                }
                            } else {
                                ahead = parseInt(stdOut);
                                if (ahead > 0) {
                                    message += '[ahead: ' + ahead + ']';
                                }

                                ChildProcess(gitCommand('rev-list --count ' + branch + '..origin/' + branch, gitDirectory), (error, stdOut, stdErr) => {
                                    if (error) {
                                        console.log(message + '[' + 'checking if behind caused error'.red + ']');
                                        if (options.verbose) {
                                            console.log(error);
                                        }
                                    } else {
                                        behind = parseInt(stdOut);
                                        if (behind > 0) {
                                            message += '[behind: ' + behind + ']';
                                        }
                                        if (ahead === 0 && behind > 0) {
                                            message += '[' + 'merging'.yellow + ']';

                                            ChildProcess(gitCommand('merge --ff-only @{u}', gitDirectory), (error, stdOut, stdErr) => {
                                                if (error) {
                                                    message += '[' + 'merge error (local changes?)'.red + ']';
                                                    if (options.verbose) {
                                                        console.log(error);
                                                    }
                                                } else {
                                                    message += '[success]';
                                                }
                                            });
                                        } else if (ahead > 0 && behind === 0) {
                                            if (options.push) {
                                                message += '[' + 'pushing'.blue + ']';

                                                ChildProcess(gitCommand('push', gitDirectory), (error, stdOut, stdErr) => {
                                                    if (error) {
                                                        message += '[' + 'push error'.red + ']';
                                                        if (options.verbose) {
                                                            console.log(error);
                                                        }
                                                    } else {
                                                        message += '[success]';
                                                    }
                                                });
                                            } else {
                                                message += '[' + 'push needed'.blue + ']';
                                            }
                                        } else if (ahead > 0 && behind > 0) {
                                            message += '[' + 'manual merge/rebase needed'.magenta + ']';
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
        });
    }

    function main() {
        parseArguments();
        let config = parseConfig();

        if (config) {
            let directories = getGitRepositories(config.directory);
            if (directories.length > 0) {
                directories.forEach(SyncRepository);
            } else {
                console.log('No git repos in the path.');
            }
        } else {
            console.log('Could not read the config file.');
        }
    }

    main();

} ());