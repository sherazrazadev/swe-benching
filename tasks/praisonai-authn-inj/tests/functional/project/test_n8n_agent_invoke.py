"""Unit tests for n8n agent invoke API endpoint."""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock


class TestAgentInvokeAPI:
    """Test the agent invoke API endpoint for n8n integration."""
    
    def test_import_agent_invoke(self):
        """Test that agent invoke module can be imported."""
        try:
            from praisonai.api.agent_invoke import (
                register_agent, 
                get_agent, 
                unregister_agent,
                list_registered_agents,
                invoke_agent_standalone
            )
            assert callable(register_agent)
            assert callable(get_agent)
            assert callable(unregister_agent)
            assert callable(list_registered_agents)
            assert callable(invoke_agent_standalone)
        except ImportError as e:
            pytest.fail(f"Failed to import agent invoke module: {e}")
    
    def test_agent_registry_operations(self):
        """Test agent registration and retrieval."""
        from praisonai.api.agent_invoke import (
            register_agent, 
            get_agent, 
            unregister_agent,
            list_registered_agents
        )
        
        # Create mock agent
        mock_agent = Mock()
        mock_agent.name = "test-agent"
        mock_agent.start.return_value = "Test response"
        
        # Test registration
        register_agent("test-agent", mock_agent)
        assert get_agent("test-agent") == mock_agent
        assert "test-agent" in list_registered_agents()
        
        # Test retrieval
        retrieved_agent = get_agent("test-agent")
        assert retrieved_agent == mock_agent
        
        # Test unregistration
        success = unregister_agent("test-agent")
        assert success is True
        assert get_agent("test-agent") is None
        assert "test-agent" not in list_registered_agents()
        
        # Test unregistering non-existent agent
        success = unregister_agent("non-existent")
        assert success is False
    
    @pytest.mark.asyncio
    async def test_invoke_agent_standalone_sync(self):
        """Test standalone agent invocation with sync agent."""
        from praisonai.api.agent_invoke import (
            register_agent,
            invoke_agent_standalone,
            unregister_agent
        )
        
        # Create mock sync agent
        mock_agent = Mock()
        mock_agent.start.return_value = "Hello from sync agent!"
        
        # Register agent
        register_agent("sync-agent", mock_agent)
        
        try:
            # Test invocation
            result = await invoke_agent_standalone(
                agent_id="sync-agent",
                message="Hello agent",
                session_id="test-session"
            )
            
            assert result["status"] == "success"
            assert result["result"] == "Hello from sync agent!"
            assert result["session_id"] == "test-session"
            assert result["agent_id"] == "sync-agent"
            
            # Verify agent was called correctly
            mock_agent.start.assert_called_once_with("Hello agent")
            
        finally:
            unregister_agent("sync-agent")
    
    @pytest.mark.asyncio
    async def test_invoke_agent_standalone_async(self):
        """Test standalone agent invocation with async agent."""
        from praisonai.api.agent_invoke import (
            register_agent,
            invoke_agent_standalone,
            unregister_agent
        )
        
        # Create mock async agent
        mock_agent = Mock()
        mock_agent.astart = AsyncMock(return_value="Hello from async agent!")
        
        # Register agent
        register_agent("async-agent", mock_agent)
        
        try:
            # Test invocation
            result = await invoke_agent_standalone(
                agent_id="async-agent",
                message="Hello async agent",
                session_id="async-session"
            )
            
            assert result["status"] == "success"
            assert result["result"] == "Hello from async agent!"
            assert result["session_id"] == "async-session"
            assert result["agent_id"] == "async-agent"
            
            # Verify agent was called correctly
            mock_agent.astart.assert_called_once_with("Hello async agent")
            
        finally:
            unregister_agent("async-agent")
    
    @pytest.mark.asyncio
    async def test_invoke_agent_standalone_not_found(self):
        """Test standalone invocation with non-existent agent."""
        from praisonai.api.agent_invoke import invoke_agent_standalone
        
        result = await invoke_agent_standalone(
            agent_id="non-existent",
            message="Hello"
        )
        
        assert result["status"] == "error"
        assert "not found" in result["error"]
        assert "available_agents" in result
    
    @pytest.mark.asyncio
    async def test_invoke_agent_standalone_error(self):
        """Test standalone invocation with agent that raises an exception."""
        from praisonai.api.agent_invoke import (
            register_agent,
            invoke_agent_standalone,
            unregister_agent
        )
        
        # Create mock agent that raises an exception
        mock_agent = Mock()
        mock_agent.start.side_effect = Exception("Agent error")
        
        # Register agent
        register_agent("error-agent", mock_agent)
        
        try:
            # Test invocation
            result = await invoke_agent_standalone(
                agent_id="error-agent",
                message="Hello"
            )
            
            assert result["status"] == "error"
            assert "Agent error" in result["error"]
            assert result["agent_id"] == "error-agent"
            
        finally:
            unregister_agent("error-agent")




# The FastAPI endpoint class in the upstream file assumes unauthenticated access to the
# agent API. That behaviour is the subject of this task, so only the registry and
# standalone-function cases (which pass on the pinned tree) are kept here.

def test_agent_invoke_smoke_test():
    """Smoke test to verify agent invoke module can be imported and used."""
    try:
        from praisonai.api.agent_invoke import (
            register_agent,
            get_agent,
            list_registered_agents,
            AgentInvokeRequest,
            AgentInvokeResponse,
            ErrorResponse
        )
        
        # Test that classes can be instantiated
        if AgentInvokeRequest is not object:  # Only if Pydantic is available
            request = AgentInvokeRequest(message="test")
            assert request.message == "test"
            assert request.session_id is None
        
        # Test basic registry functions
        assert callable(register_agent)
        assert callable(get_agent)
        assert isinstance(list_registered_agents(), list)
        
    except Exception as e:
        pytest.fail(f"Agent invoke smoke test failed: {e}")


if __name__ == "__main__":
    # Run smoke test when executed directly
    test_agent_invoke_smoke_test()
    print("✅ Agent invoke API smoke test passed")
