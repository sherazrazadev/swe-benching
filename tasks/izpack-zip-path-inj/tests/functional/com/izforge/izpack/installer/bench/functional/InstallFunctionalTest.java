package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * Legitimate installations keep working: nested targets, absolute targets outside the
 * installation directory, and directory entries.
 */
public class InstallFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void nestedTargetInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("nested");
        File src = InstallerFixture.source("nestsrc", "nested");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/sub/file.txt", null,
                     OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE, null, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertEquals("nested", new String(Files.readAllBytes(
                new File(fixture.installDir(), "sub/file.txt").toPath()), StandardCharsets.UTF_8));
    }

    @Test
    public void absoluteTargetOutsideInstallRootInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("absolute");
        File src = InstallerFixture.source("abssrc", "absolute");
        File outside = new File(fixture.root(), "outside-tree");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, outside.getAbsolutePath() + "/config.txt", null,
                     OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE, null, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertEquals("absolute", new String(Files.readAllBytes(
                new File(outside, "config.txt").toPath()), StandardCharsets.UTF_8));
    }

    @Test
    public void directoryTargetIsCreated() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File dir = new File(tmp.getRoot(), "source-dir");
        if (!dir.mkdirs() && !dir.isDirectory())
        {
            throw new IOException("cannot create source directory");
        }
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(dir.getParentFile(), dir, "${INSTALL_PATH}/sub/newdir", null,
                     OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE, null, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertTrue(new File(fixture.installDir(), "sub/newdir").isDirectory());
    }

    @Test
    public void nameContainingDotsThatIsNotASegmentInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("dots");
        File src = InstallerFixture.source("dotssrc", "dots");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/a..b.txt", null,
                     OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE, null, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertEquals("dots", new String(Files.readAllBytes(
                new File(fixture.installDir(), "a..b.txt").toPath()), StandardCharsets.UTF_8));
    }
}
