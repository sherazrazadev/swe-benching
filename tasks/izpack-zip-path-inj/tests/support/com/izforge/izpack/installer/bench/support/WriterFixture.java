package com.izforge.izpack.installer.bench.support;

import com.izforge.izpack.api.data.AutomatedInstallData;
import com.izforge.izpack.api.data.Info;
import com.izforge.izpack.api.rules.RulesEngine;
import com.izforge.izpack.core.data.DefaultVariables;
import com.izforge.izpack.installer.data.UninstallData;
import com.izforge.izpack.installer.data.UninstallDataWriter;
import com.izforge.izpack.merge.resolve.PathResolver;
import com.izforge.izpack.util.Platform;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Properties;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Drives the installer's uninstall-data writer, the step that prepares the removal data and
 * its log once the packs have been installed.
 *
 * <p>The writer is constructed exactly as the installer constructs it, with the compiled
 * installer's information and variables; the test supplies the values it wants the metadata to
 * carry and asserts on the files that appear on disk.</p>
 *
 * <p>Values are admitted through the real interfaces while the fixture is populated, and the
 * values the test wants the compiled metadata to carry are installed directly in the metadata
 * objects just before the writer runs, exactly as deserialised metadata arrives. This models a
 * crafted installer without forcing a particular layer to be the one that refuses the value.</p>
 */
public class WriterFixture
{
    /**
     * Variable the installer reads the location of its external log from.
     */
    public static final String LOG_PATH_VARIABLE = "InstallerFrame.logfilePath";

    private static final String DECLARED_UNINSTALLER_PATH = "${INSTALL_PATH}/Uninstaller";
    private static final String DECLARED_UNINSTALLER_NAME = "uninstaller.jar";

    private final File root;
    private final File installDir;
    private final Info info = new Info();
    private final DefaultVariables variables = new DefaultVariables();
    private final AutomatedInstallData installData;
    private final UninstallData uninstallData = new UninstallData();

    private String craftedUninstallerPath;
    private String craftedUninstallerName;
    private String craftedLogPath;

    public WriterFixture(File root) throws IOException
    {
        this.root = root;
        this.installDir = new File(root, "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        installData = new AutomatedInstallData(variables, mock(Platform.class));
        installData.setInfo(info);
        installData.setInstallPath(installDir.getAbsolutePath());
        info.setUninstallerPath(DECLARED_UNINSTALLER_PATH);
        info.setUninstallerName(DECLARED_UNINSTALLER_NAME);
    }

    public File root()
    {
        return root;
    }

    public File installDir()
    {
        return installDir;
    }

    /** Declares the directory the uninstaller data is written to. */
    public WriterFixture uninstallerPath(String path)
    {
        craftedUninstallerPath = path;
        return this;
    }

    /** Declares the uninstaller file name. */
    public WriterFixture uninstallerName(String name)
    {
        craftedUninstallerName = name;
        return this;
    }

    /** Registers a variable value, as the compiler's defaults or the user's properties supply it. */
    public WriterFixture variable(String name, String value)
    {
        if (LOG_PATH_VARIABLE.equals(name))
        {
            craftedLogPath = value;
            installData.setVariable(name, "");
        }
        else
        {
            installData.setVariable(name, value);
        }
        return this;
    }

    /** Records a file as installed, exactly as the unpacker records every entry it installs. */
    public WriterFixture installedFile(File file)
    {
        uninstallData.addFile(file.getAbsolutePath(), true);
        return this;
    }

    /** Runs the writer and returns its result. */
    public boolean write() throws Exception
    {
        applyCraftedMetadata();
        PathResolver resolver = mock(PathResolver.class);
        when(resolver.getMergeableFromPath(anyString())).thenReturn(new ArrayList<>());
        UninstallDataWriter writer = new UninstallDataWriter(uninstallData, installData, resolver,
                                                            mock(RulesEngine.class));
        return writer.write();
    }

    /**
     * Installs the declared values directly in the metadata objects, as a crafted compiled
     * installer delivers them through deserialisation or configuration.
     */
    private void applyCraftedMetadata() throws Exception
    {
        if (craftedUninstallerPath != null)
        {
            InstallerFixture.field(info, "uninstallerPath", craftedUninstallerPath);
        }
        if (craftedUninstallerName != null)
        {
            InstallerFixture.field(info, "uninstallerName", craftedUninstallerName);
        }
        if (craftedLogPath != null)
        {
            ((Properties) readField(variables, "properties")).setProperty(LOG_PATH_VARIABLE, craftedLogPath);
        }
    }

    private static Object readField(Object object, String name) throws Exception
    {
        Class<?> type = object.getClass();
        while (type != null)
        {
            try
            {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                return field.get(object);
            }
            catch (NoSuchFieldException exception)
            {
                type = type.getSuperclass();
            }
        }
        throw new NoSuchFieldException(name);
    }
}
