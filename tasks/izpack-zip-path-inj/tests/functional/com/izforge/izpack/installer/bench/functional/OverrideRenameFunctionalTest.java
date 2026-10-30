package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;

import static org.junit.Assert.assertEquals;

/**
 * A rename destination that stays inside the installation directory keeps working.
 */
public class OverrideRenameFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void existingFileRenamedWithinDirectory() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("new");
        File src = InstallerFixture.source("renamefunc", "new");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/target.txt", null, OverrideType.OVERRIDE_TRUE,
                     "backup-", Blockable.BLOCKABLE_NONE, null, null, null);
        fixture.prepare(Collections.singletonList(pack));

        File existing = new File(fixture.installDir(), "target.txt");
        Files.write(existing.toPath(), "old".getBytes(StandardCharsets.UTF_8));

        fixture.unpacker().run();

        assertEquals("old", new String(Files.readAllBytes(
                new File(fixture.installDir(), "backup-target.txt").toPath()), StandardCharsets.UTF_8));
        assertEquals("new", new String(Files.readAllBytes(existing.toPath()), StandardCharsets.UTF_8));
    }
}
