<!-- <div align="center">

<img src="https://arceos-hypervisor.github.io/doc/assets/logo.svg" alt="axvisor-logo" width="64">

</div> -->

<h2 align="center">AxVisor Book</h1>

<p align="center">基于 Docusaurus 创建的统一模块化虚拟机管理程序 AxVisor 的在线文档</p>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/arceos-hypervisor/axvisor?logo=github)](https://github.com/arceos-hypervisor/axvisor/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/arceos-hypervisor/axvisor?logo=github)](https://github.com/arceos-hypervisor/axvisor/network)
[![license](https://img.shields.io/github/license/arceos-hypervisor/axvisor)](https://github.com/arceos-hypervisor/axvisor/blob/master/LICENSE)

</div>

[English](README.md) | 中文

# 简介

本仓库是使用 [Docusaurus](https://docusaurus.io/) 构建 AxVisor 的文档的源码仓库。Docusaurus 是有 Meta 开源的基于 React 开发的一个用于创建、维护和部署静态网站的网站生成工具。

## 开发

### 开发环境

Docusaurus 实际上是一组 Node.js 包，因此，本文档实际上是一个 Node.js 应用。所以，首先需要确保正确安装了 Node.js 环境。

1. 使用 `yarn` 作为维护工具，默认的 Node.js 中并没有安装 `yarn`，因此，首先使用命令 `npm install -g yarn` 进行全局安装
2. 首次进行开发需要先试用命令 `yarn install` 安装所需的依赖包
3. 使用任意编辑器（推荐 VS Code）进行修改源码，编辑新文档（全部采用 Markdown 格式）

### 编写文档

mdbook 是一个将 Markdown 文档作为源文件的文档系统，因此，我们只需要以 Markdown 语法编写源文件即可。

源码中的 `./src/SUMMARY.md` 是文档的目录，当新增了源文件之后，需要在其中添加上对应的文件路径

### 构建

通过命令 `yarn start` 将会在本地启动的开发服务器，并自动打开浏览器窗口预览整个网站

## 部署

目前，AxVisor 的文档网站托管在了 GitHub Pages 上：https://arceos-hypervisor.github.io/axvisorbook/ ，仓库默认配置为通过 GitHub Action 进行部署，当把源码提交到仓库之后将自动触发 GitHub Action 进行部署。

## 如何贡献

欢迎 FORK 本仓库，然后提交 PR。

## 许可协议

AxVisor Book 使用如下开源协议：

 * Apache-2.0
 * MulanPubL-2.0
 * MulanPSL2
 * GPL-3.0-or-later
