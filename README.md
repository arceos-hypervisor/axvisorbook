<div align="center">

<img src="https://arceos-hypervisor.github.io/images/site/logo.svg" alt="axvisor-logo" width="64">

</div>

<h2 align="center">AxVisor</h1>

<p align="center">A unified modular hypervisor based on ArceOS</p>

<!-- <div align="center">

[![GitHub stars](https://img.shields.io/github/stars/arceos-hypervisor/AxVisor?logo=github)](https://github.com/arceos-hypervisor/AxVisor/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/arceos-hypervisor/AxVisor?logo=github)](https://github.com/arceos-hypervisor/AxVisor/network)
[![license](https://img.shields.io/github/license/arceos-hypervisor/AxVisor)](https://github.com/ZCShou/GoGoGo/blob/master/LICENSE)

</div> -->

English | [中文版](README_CN.md)

# Introduction

This repository is the source repository for the AxVisor documentation built using [Docusaurus](https://docusaurus.io/). Docusaurus is an open-source website generator tool developed by Meta, based on React, for creating, maintaining, and deploying static websites.

## Development

Docusaurus is actually a set of Node.js packages, so this documentation is essentially a Node.js application. Therefore, the first step is to ensure that the Node.js environment is correctly installed.

1. Yarn is used as the package manager. By default, yarn is not installed in Node.js, so first, use the command `npm install -g yarn` to install it globally.
2. To start development for the first time, you need to run the command `yarn install` to install the required dependencies.
3. Use any editor (VS Code is recommended) to modify the source code and edit new documents (all in Markdown format)
4. Running the command `yarn start` will start a local development server and automatically open a browser window to preview the entire website.

## Deploy

Currently, the AxVisor documentation website is hosted on GitHub Pages. The repository is configured by default to deploy via GitHub Actions. When the source code is committed to the repository, it will automatically trigger GitHub Actions to deploy the website.

> It also supports yarn deploy for deploying to a separate branch (after modifying the repository configuration).
>  - Linux:
>    - Use SSH:
>        ```
>        $ USE_SSH=true yarn deploy
>        ```
> 
>    - Not use SSH:
> 
>        ```
>        $ GIT_USER=<Your GitHub username> yarn deploy
>        ```
>  - Windows PowerShell:
>    - Use SSH:
> 
>        ```
>        $ cmd /C 'set "USE_SSH=true" && yarn deploy'
>        ```
> 
>    - Not use SSH:
> 
>        ```
>        $ cmd /C 'set "GIT_USER=<Your GitHub username>" && yarn deploy'
>        ```
