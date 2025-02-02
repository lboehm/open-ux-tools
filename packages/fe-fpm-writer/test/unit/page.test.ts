import { create as createStorage } from 'mem-fs';
import { create, Editor } from 'mem-fs-editor';
import { join } from 'path';
import { ManifestNamespace } from '@sap-ux/ui5-config';
import { generateCustomPage, validateBasePath, CustomPage } from '../../src';
import { validateCustomPageConfig } from '../../src/page';
import { Manifest } from '../../src/common/types';
import { FCL_ROUTER } from '../../src/common/defaults';

describe('CustomPage', () => {
    const testDir = '' + Date.now();
    let fs: Editor;

    const testAppManifest = JSON.stringify(
        {
            'sap.app': {
                id: 'my.test.App'
            },
            'sap.ui5': {
                dependencies: {
                    libs: {
                        'sap.fe.templates': {}
                    }
                },
                routing: {
                    routes: [
                        {
                            pattern: ':?query:',
                            name: 'TestObjectPage',
                            target: 'TestObjectPage'
                        }
                    ] as ManifestNamespace.Route[],
                    targets: {
                        TestObjectPage: {}
                    }
                }
            }
        },
        null,
        2
    );

    beforeEach(() => {
        fs = create(createStorage());
        fs.delete(testDir);
    });

    test('validateBasePath', () => {
        const target = join(testDir, 'validateBasePath');
        fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
        expect(validateBasePath(target, fs)).toBeTruthy();

        expect(() => validateBasePath(join(testDir, '' + Date.now()))).toThrowError();
        expect(() => generateCustomPage(join(testDir, '' + Date.now()), {} as CustomPage)).toThrowError();

        const invalidManifest = JSON.parse(testAppManifest);
        delete invalidManifest['sap.ui5'].dependencies?.libs['sap.fe.templates'];
        fs.writeJSON(join(target, 'webapp/manifest.json'), invalidManifest);
        expect(() => validateBasePath(target, fs)).toThrowError();
    });

    describe('validateCustomPageConfig', () => {
        const config: CustomPage = {
            name: 'CustomPage',
            entity: 'ChildEntity',
            navigation: {
                sourcePage: 'TestObjectPage',
                sourceEntity: 'RootEntity',
                navEntity: 'navToChildEntity',
                navKey: true
            }
        };

        test('provided navigation config is valid for existing manifest', async () => {
            const target = join(testDir, 'validateNavigation');
            const manifest = JSON.parse(testAppManifest) as Manifest;

            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).not.toThrowError();
        });

        test('provided navigation config is not valid for existing manifest', () => {
            const target = join(testDir, 'invalidateNavigation');

            let manifest = JSON.parse(testAppManifest) as Manifest;

            manifest['sap.ui5']!.routing!.routes = [];
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();

            delete manifest['sap.ui5']!.routing!.routes;
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();

            manifest = JSON.parse(testAppManifest) as Manifest;

            delete manifest['sap.ui5']!.routing!.targets!['TestObjectPage'];
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();

            delete manifest['sap.ui5']!.routing!.targets;
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();

            delete manifest['sap.ui5']!.routing;
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();

            delete manifest['sap.ui5'];
            fs.writeJSON(join(target, 'webapp/manifest.json'), manifest);
            expect(() => validateCustomPageConfig(target, config, fs)).toThrowError();
        });
    });

    describe('generateCustomPage: different versions or target folder', () => {
        const minimalInput: CustomPage = {
            name: 'CustomPage',
            entity: 'RootEnity'
        };
        test('latest version with minimal input', () => {
            const target = join(testDir, 'minimal-input');
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            generateCustomPage(target, minimalInput, fs);

            expect(fs.readJSON(join(target, 'webapp/manifest.json'))).toMatchSnapshot();
            expect(fs.read(join(target, 'webapp/ext/customPage/CustomPage.view.xml'))).toMatchSnapshot();
            expect(fs.read(join(target, 'webapp/ext/customPage/CustomPage.controller.js'))).toMatchSnapshot();
        });

        test('with older but supported UI5 version', () => {
            const target = join(testDir, 'version-1.84');
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            generateCustomPage(target, { ...minimalInput, ui5Version: 1.84 }, fs);

            expect(fs.readJSON(join(target, 'webapp/manifest.json'))).toMatchSnapshot();
            expect(fs.read(join(target, 'webapp/ext/customPage/CustomPage.view.xml'))).toMatchSnapshot();
            expect(fs.read(join(target, 'webapp/ext/customPage/CustomPage.controller.js'))).toMatchSnapshot();
        });

        test('with not supported version', () => {
            const target = join(testDir, 'version-not-supported');
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            expect(() => generateCustomPage(target, { ...minimalInput, ui5Version: 1.83 }, fs)).toThrowError();
        });

        test('latest version with minimal input but different target folder', () => {
            const target = join(testDir, 'different-folder');
            const folder = 'ext/different';
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            generateCustomPage(target, { ...minimalInput, folder }, fs);

            expect(fs.readJSON(join(target, 'webapp/manifest.json'))).toMatchSnapshot();
            expect(fs.read(join(target, `webapp/${folder}/CustomPage.view.xml`))).toMatchSnapshot();
            expect(fs.read(join(target, `webapp/${folder}/CustomPage.controller.js`))).toMatchSnapshot();
        });
        test('with existing target files', () => {
            const target = join(testDir, 'different-folder');
            const folder = 'ext/different';
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            const viewPath = join(target, `webapp/${folder}/CustomPage.view.xml`);
            fs.write(viewPath, 'viewContent');
            const controllerPath = join(target, `webapp/${folder}/CustomPage.controller.js`);
            fs.write(controllerPath, 'controllerContent');
            //sut
            generateCustomPage(target, { ...minimalInput, folder }, fs);
            expect(fs.readJSON(join(target, 'webapp/manifest.json'))).toMatchSnapshot();
            expect(fs.exists(controllerPath)).toBe(true);
            expect(fs.read(controllerPath)).toEqual('controllerContent');
            expect(fs.exists(viewPath)).toBe(true);
            expect(fs.read(viewPath)).toEqual('viewContent');
        });
    });

    describe('generateCustomPage: different navigations', () => {
        const inputWithNavigation: CustomPage = {
            name: 'CustomPage',
            entity: 'ChildEntity',
            navigation: {
                sourcePage: 'TestObjectPage',
                sourceEntity: 'RootEntity',
                navEntity: 'navToChildEntity',
                navKey: true
            }
        };

        test('simple inbound navigation', () => {
            const target = join(testDir, 'with-nav');
            fs.write(join(target, 'webapp/manifest.json'), testAppManifest);
            generateCustomPage(target, inputWithNavigation, fs);
            expect((fs.readJSON(join(target, 'webapp/manifest.json')) as any)!['sap.ui5'].routing).toMatchSnapshot();
        });

        test('inbound navigation defined as array (for FCL)', () => {
            const testManifestWithArray = JSON.parse(testAppManifest);
            testManifestWithArray['sap.ui5'].routing.config = {
                routerClass: FCL_ROUTER
            };
            testManifestWithArray['sap.ui5'].routing.routes = [
                {
                    pattern: 'RootEntity({key}):?query:',
                    name: 'TestObjectPage',
                    target: ['TestObjectPage']
                }
            ];
            const target = join(testDir, 'target-as-array');
            fs.writeJSON(join(target, 'webapp/manifest.json'), testManifestWithArray);
            generateCustomPage(target, inputWithNavigation, fs);
            expect((fs.readJSON(join(target, 'webapp/manifest.json')) as any)!['sap.ui5'].routing).toMatchSnapshot();
        });

        test('inbound navigation defined as array with max nesting for FCL', () => {
            const testManifestWithArray = JSON.parse(testAppManifest);
            testManifestWithArray['sap.ui5'].routing.config = {
                routerClass: FCL_ROUTER
            };
            testManifestWithArray['sap.ui5'].routing.routes = [
                {
                    pattern: 'RootEntity({key})/NestedEntiry({nestedKey}):?query:',
                    name: 'TestObjectPage',
                    target: ['TestList', 'TestNestedList', 'TestObjectPage']
                }
            ];
            const target = join(testDir, 'target-as-nested-array');
            fs.writeJSON(join(target, 'webapp/manifest.json'), testManifestWithArray);
            generateCustomPage(target, inputWithNavigation, fs);
            expect((fs.readJSON(join(target, 'webapp/manifest.json')) as any)!['sap.ui5'].routing).toMatchSnapshot();
        });
    });

    describe('generateCustomPage: only page, no others', () => {
        const input: CustomPage = {
            name: 'CustomPage',
            entity: 'MainEntity'
        };
        const testManifestWithNoRouting = JSON.parse(testAppManifest);
        delete testManifestWithNoRouting['sap.ui5'].routing;

        test('FCL enabled single page app', () => {
            testManifestWithNoRouting['sap.ui5'].routing = {
                config: {
                    routerClass: 'sap.f.routing.Router'
                }
            };
            const target = join(testDir, 'single-page-fcl');
            fs.writeJSON(join(target, 'webapp/manifest.json'), testManifestWithNoRouting);
            generateCustomPage(target, { ...input }, fs);
            expect((fs.readJSON(join(target, 'webapp/manifest.json')) as any)!['sap.ui5'].routing).toMatchSnapshot();
        });

        test('No FCL single page app', () => {
            delete testManifestWithNoRouting['sap.ui5'].routing;
            const target = join(testDir, 'single-page-no-fcl');
            fs.writeJSON(join(target, 'webapp/manifest.json'), testManifestWithNoRouting);
            generateCustomPage(target, input, fs);
            expect((fs.readJSON(join(target, 'webapp/manifest.json')) as any)!['sap.ui5'].routing).toMatchSnapshot();
        });
    });
});
