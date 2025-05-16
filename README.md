<!-- <div align="center">

<img src="https://arceos-hypervisor.github.io/doc/assets/logo.svg" alt="axvisor-logo" width="64">

</div> -->

<h2 align="center">AxVisor Book</h1>

<p align="center">The online documentation built with Docusaurus for unified modular hypervisor AxVisor.</p>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/arceos-hypervisor/axvisor?logo=github)](https://github.com/arceos-hypervisor/axvisor/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/arceos-hypervisor/axvisor?logo=github)](https://github.com/arceos-hypervisor/axvisor/network)
[![license](https://img.shields.io/github/license/arceos-hypervisor/axvisor)](https://github.com/arceos-hypervisor/axvisor/blob/master/LICENSE)

</div>

English | [中文](README_CN.md)

# Introduction

This repository is the source repository for the AxVisor documentation built using [Docusaurus](https://docusaurus.io/). Docusaurus is an open-source website generator tool developed by Meta, based on React, for creating, maintaining, and deploying static websites.

## Development

### Environment

Docusaurus is actually a set of Node.js packages, so this documentation is essentially a Node.js application. Therefore, the first step is to ensure that the Node.js environment is correctly installed.
1. Yarn is used as the package manager. By default, yarn is not installed in Node.js, so first, use the command `npm install -g yarn` to install it globally.
2. To start development for the first time, you need to run the command `yarn install` to install the required dependencies.
3. Use any editor (VS Code is recommended) to modify the source code and edit new documents (all in Markdown format)

### Source file

mdbook is a documentation system that uses Markdown files as source files. Therefore, we only need to write the source files using Markdown syntax.

The `./src/SUMMARY.md` file in the source code is the table of contents for the documentation. When new source files are added, their corresponding file paths need to be added to this file.

### Build

Running the command `yarn start` will start a local development server and automatically open a browser window to preview the entire website.

## Deploy

Currently, the AxVisor documentation website is hosted on GitHub Pages: https://arceos-hypervisor.github.io/axvisorbook/. The repository is configured to deploy via GitHub Actions by default. Once the source code is committed to the repository, GitHub Actions will be automatically triggered to deploy the site.

## Contributing

Feel free to fork this repository and submit a PR.

## License

AxVisor Book uses the following open-source license:

 * Apache-2.0
 * MulanPubL-2.0
 * MulanPSL2
 * GPL-3.0-or-later
