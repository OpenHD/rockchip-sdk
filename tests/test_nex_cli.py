"""CLI regression tests; vendor build and device tools are never executed."""
import contextlib
import importlib.machinery
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
loader = importlib.machinery.SourceFileLoader('nex_cli', str(ROOT / 'nex'))
spec = importlib.util.spec_from_loader(loader.name, loader)
nex = importlib.util.module_from_spec(spec)
loader.exec_module(nex)


class CliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        profile = self.root / 'device/rockchip/.chips/rk_test/test_defconfig'
        profile.parent.mkdir(parents=True)
        profile.write_text('# fixture')
        self.root_patch = patch.object(nex, 'ROOT', self.root)
        self.root_patch.start()
        self.output = io.StringIO()
        self.stdout = contextlib.redirect_stdout(self.output)
        self.stderr = contextlib.redirect_stderr(self.output)
        self.stdout.__enter__()
        self.stderr.__enter__()

    def tearDown(self):
        self.stderr.__exit__(None, None, None)
        self.stdout.__exit__(None, None, None)
        self.root_patch.stop()
        self.temp.cleanup()

    def rk(self, command, *extra):
        return [command, '--soc', 'rockchip', '--profile', 'rk_test:test_defconfig', *extra]

    def hi(self, command, *extra):
        return [command, '--soc', nex.HI_SOC, '--board', nex.HI_BOARD, *extra]

    def test_install_never_runs_tools(self):
        with patch.object(nex, 'run') as run:
            self.assertEqual(nex.main(self.rk('install')), 1)
            self.assertEqual(nex.main(self.rk('install', '--dry-run')), 0)
            self.assertEqual(nex.main(self.hi('install', '--dry-run')), 1)
            run.assert_not_called()
        self.assertFalse((self.root / 'output').exists())

    def test_rejects_unlisted_and_cross_platform_profiles(self):
        for argv in (['plan', '--soc', 'rockchip', '--profile', '../test'],
                     self.hi('plan', '--profile', 'rk_test:test_defconfig'),
                     ['plan', '--soc', nex.HI_SOC, '--board', 'donor']):
            with self.assertRaises(ValueError):
                nex.main(argv)

    def test_build_stops_after_failed_configuration(self):
        with patch.object(nex, 'doctor', return_value=0), patch.object(nex, 'run', return_value=7) as run:
            self.assertEqual(nex.main(self.rk('build')), 7)
            self.assertEqual(run.call_count, 1)

    def test_rockchip_sequence_and_ui(self):
        with patch.object(nex, 'doctor', return_value=0), patch.object(nex, 'run', return_value=0) as run:
            self.assertEqual(nex.main(self.rk('build', '--with-ui', '--stage', 'rootfs')), 0)
            self.assertEqual([call.args[0][-1] for call in run.call_args_list],
                             [self.root / 'tools/nex-os/build.sh', 'rk_test:test_defconfig', 'rootfs'])

    def test_failed_doctor_never_builds(self):
        with patch.object(nex, 'doctor', return_value=1), patch.object(nex, 'run') as run:
            self.assertEqual(nex.main(self.rk('build')), 1)
            run.assert_not_called()

    def test_hisilicon_delegation_and_ui_block(self):
        with patch.object(nex, 'run', return_value=1) as run:
            self.assertEqual(nex.main(self.hi('build')), 1)
            self.assertEqual(run.call_args.args[0], ['bash', self.root / 'build.sh', '--soc', nex.HI_SOC, '--board', nex.HI_BOARD, 'all'])
            with self.assertRaises(ValueError):
                nex.main(self.hi('build', '--with-ui'))

    def test_wizard_reads_only(self):
        with patch('sys.stdin.isatty', return_value=True), patch('builtins.input', side_effect=['1', '2']), patch.object(nex, 'run') as run:
            self.assertEqual(nex.main(['wizard']), 1)
            run.assert_not_called()

    def test_catalog_and_noninteractive(self):
        self.assertEqual(nex.main(['targets']), 0)
        self.assertIn('rk_test:test_defconfig', self.output.getvalue())
        with patch('sys.stdin.isatty', return_value=False):
            self.assertEqual(nex.main([]), 0)
            with self.assertRaises(ValueError):
                nex.main(['wizard'])


if __name__ == '__main__':
    unittest.main()
