package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackFile;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import com.izforge.izpack.installer.unpacker.Unpacker;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import java.util.Iterator;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

/**
 * Target locations read from a compiled installer's metadata must not escape through a
 * parent-directory segment, in every shape the metadata can carry one.
 */
public class UnpackerTargetSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void installRefusesTraversingTarget() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("owned");
        File src = InstallerFixture.source("l1src", "owned");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/ok.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        PackFile file = pack.getPackFiles().iterator().next();
        InstallerFixture.target(file, fixture.installDir().getAbsolutePath() + "/../escape/l1.txt");
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertFalse(new File(fixture.root(), "escape/l1.txt").exists());
    }

    @Test
    public void installRefusesTraversalIntroducedByVariable() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("owned");
        fixture.variable("TARGET_DIR", fixture.installDir().getAbsolutePath() + "/../escape");
        File src = InstallerFixture.source("varsrc", "owned");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/ok.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        PackFile file = pack.getPackFiles().iterator().next();
        InstallerFixture.target(file, "${TARGET_DIR}/var.txt");
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertFalse(new File(fixture.root(), "escape/var.txt").exists());
    }

    @Test
    public void installRefusesTraversingDirectoryTarget() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File dir = new File(tmp.getRoot(), "source-dir");
        if (!dir.mkdirs() && !dir.isDirectory())
        {
            throw new IOException("cannot create source directory");
        }
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(dir.getParentFile(), dir, "${INSTALL_PATH}/made", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        PackFile file = pack.getPackFiles().iterator().next();
        InstallerFixture.target(file, "${INSTALL_PATH}/../escape/made");
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertFalse(new File(fixture.root(), "escape/made").exists());
    }

    @Test
    public void refusedEntryIsReportedAndAnotherEntryInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("bad1kept");
        File bad = InstallerFixture.source("p3bad", "bad1");
        File kept = InstallerFixture.source("p3kept", "kept");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(bad.getParentFile(), bad, "${INSTALL_PATH}/bad.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        pack.addFile(kept.getParentFile(), kept, "${INSTALL_PATH}/kept.txt", null,
                     OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE, null, null, null);
        Iterator<PackFile> files = pack.getPackFiles().iterator();
        InstallerFixture.target(files.next(), "${INSTALL_PATH}/../escape/p3.txt");
        fixture.prepare(Collections.singletonList(pack));

        Unpacker unpacker = fixture.unpacker();
        unpacker.run();

        assertFalse("a traversing target was written outside the installation directory",
                    new File(fixture.root(), "escape/p3.txt").exists());
        assertEquals("a legitimate entry after the refused one did not install", "kept",
                     new String(Files.readAllBytes(
                             new File(fixture.installDir(), "kept.txt").toPath()),
                             StandardCharsets.UTF_8));
        assertFalse("the traversing entry was not rejected with an error", unpacker.getResult());
        for (String recorded : fixture.uninstallData().getInstalledFilesList())
        {
            assertFalse("the refused entry was recorded as installed: " + recorded,
                        recorded.contains("escape"));
        }
    }
}
