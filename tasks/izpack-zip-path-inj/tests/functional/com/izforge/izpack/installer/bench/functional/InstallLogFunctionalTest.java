package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.installer.bench.support.WriterFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import static org.junit.Assert.assertTrue;

/**
 * A log location inside the installation directory keeps being written, with one line per
 * installed file.
 */
public class InstallLogFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void declaredLogFileIsWritten() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        File installed = new File(fixture.installDir(), "app.txt");
        fixture.installedFile(installed);
        fixture.uninstallerPath("${INSTALL_PATH}/Uninstaller");
        fixture.uninstallerName("uninstaller.jar");
        File log = new File(fixture.installDir(), "install.log");
        fixture.variable(WriterFixture.LOG_PATH_VARIABLE, log.getAbsolutePath());

        assertTrue("the installation data was not written", fixture.write());

        assertTrue("the log is missing", log.isFile());
        String content = new String(Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8);
        assertTrue("the log does not list the installed file: " + content,
                   content.contains(installed.getAbsolutePath()));
        assertTrue("the log does not list the removal data: " + content,
                   content.contains("uninstaller.jar"));
    }

    @Test
    public void derivedLogFileIsWritten() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        File installed = new File(fixture.installDir(), "app.txt");
        fixture.installedFile(installed);
        fixture.uninstallerPath("${INSTALL_PATH}/Uninstaller");
        fixture.uninstallerName("uninstaller.jar");
        fixture.variable(WriterFixture.LOG_PATH_VARIABLE, "default");

        assertTrue("the installation data was not written", fixture.write());

        File log = new File(new File(fixture.installDir(), "Uninstaller"), "install.log");
        assertTrue("the derived log is missing", log.isFile());
        String content = new String(Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8);
        assertTrue("the derived log does not list the installed file: " + content,
                   content.contains(installed.getAbsolutePath()));
    }

    @Test
    public void logFileOutsideTheInstallDirectoryIsWritten() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        File installed = new File(fixture.installDir(), "app.txt");
        fixture.installedFile(installed);
        fixture.uninstallerPath("${INSTALL_PATH}/Uninstaller");
        fixture.uninstallerName("uninstaller.jar");
        File log = new File(new File(tmp.getRoot(), "logs"), "install.log");
        fixture.variable(WriterFixture.LOG_PATH_VARIABLE, log.getAbsolutePath());

        assertTrue("the installation data was not written", fixture.write());

        assertTrue("the log is missing", log.isFile());
        assertTrue("the log does not list the installed file",
                   new String(Files.readAllBytes(log.toPath()), StandardCharsets.UTF_8)
                           .contains(installed.getAbsolutePath()));
    }
}
