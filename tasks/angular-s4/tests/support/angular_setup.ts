import 'reflect-metadata';
import '@angular/compiler';

import {NgModule, provideZonelessChangeDetection} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {BrowserTestingModule, platformBrowserTesting} from '@angular/platform-browser/testing';

@NgModule({providers: [provideZonelessChangeDetection()]})
class ProbeTestModule {}

TestBed.initTestEnvironment([BrowserTestingModule, ProbeTestModule], platformBrowserTesting());
