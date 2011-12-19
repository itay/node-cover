## Cover - Native JavaScript Code Coverage

Cover gives you the ability to collect code-coverage for your projects, using
whatever unit test framework you want, and all using native JavaScript. It also
comes bundled with pre-defined reporters, such as HTML and CLI output, so you
can easily see where you are missing coverage.

### Standing on the shoulders of giants

I would be amiss to not mention that the hard work in this library were done
by [substack] with his work on [bunker], and by [Chris Dickinson] with his
work on [runforcover]. In reality, Cover is a fork of runforcover, fixing
some of the issues and making it more usable.

### Known Issues

There are currently a few known issues that I am working on:

1. You cannot use process.stdin in your program. This is because of a bug in
Node itself, where it will cause the program to not exit. Working on a fix.

2. There is currently a bug in [bunker] in regards to wrapping code incorrectly,
causing code to become not-executable. This happens in `vows`, for example. The 
workaround is to simply exclude those files from code coverage.

### Usage

Using Cover is simple. Simply install it globally:

> npm install cover -g

And then, run it

> cover run mytests.js

Want to pass some arguments to your test? No problem (note the `--`):

> cover run mytests.js -- --arg1 --arg2=foo

 Once you've run your tests, it will create a directory with coverage data in it.
 If you want to see the coverage report, simply run:
 
 > cover report
 
 which will output the report to the CLI. Want to get an HTML report?
 
 > cover report html
 
 This will create a `cover_html` directory with the coverage information.
 
 ### Configuration
 
 Cover reads from a `.coverrc` file in your project directory, and it comes
 with sensible defaults. Here are the defaults that it uses:
 
     {
        "formatter": "cli",
        "ignore": ".coverignore",
        
        "prefix": "coveragefile_",              // Prefix for coverage data files
        "dataDirectory": ".coverage_data",      // Directory to put coverage files in
        
        // Formatter-specific info
        "html" : {
            "directory": "cover_html",          // Directory to write HTML files too
            "generateIndex": true               // Whether to generate an index.html file
        },
        
        "json": {
        }
    }
    
You can also specify which files to ignore using .coverignore. Here is the one used
for Cover itself:

    node_modules
    
You can specify both files and directories in the `.coverignore` file.

If you have a customer path for your configuration files, you can specify this
on the command line:

> cover --config path/to/config --ignore path/to/ignore run myfile.js

[substack]: https://github.com/substack
[bunker]: https://github.com/substack/node-bunker
[Chris Dickinson]: https://github.com/chrisdickinson
[runforcover]: https://github.com/chrisdickinson/node-runforcover